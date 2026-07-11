"use client";

import * as React from "react";
import {
  AlertTriangle,
  Check,
  ChevronsUpDown,
  Loader2,
  RefreshCw,
} from "lucide-react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { listAvailableModels } from "@/actions/ai.actions";
import { FALLBACK_MODELS } from "@/lib/ai/model-catalog";
import type { AiProvider } from "@/config/ai";

// ---------------------------------------------------------------------------
// Model picker combobox
//
// The visible field is always a free-text `Input` — the typed value is what
// gets saved, no matter what. The popover (Command list) is purely a
// convenience for picking from the provider's own model list (or, on
// failure, a static suggestion list) without having to know exact model ids
// by heart. Selecting an item just writes into the same `Input`.
// ---------------------------------------------------------------------------

interface AiModelComboboxProps {
  id?: string;
  provider: AiProvider;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  /** An already-saved profile id — lets the picker use the stored key when the draft key field is blank. */
  profileId?: string;
  /** Live draft API key typed in the form, if any (takes precedence over `profileId`'s stored key). */
  draftApiKey?: string;
  draftBaseUrl?: string;
  placeholder?: string;
  disabled?: boolean;
  "aria-invalid"?: boolean;
}

export function AiModelCombobox({
  id,
  provider,
  value,
  onChange,
  onBlur,
  profileId,
  draftApiKey,
  draftBaseUrl,
  placeholder,
  disabled,
  "aria-invalid": ariaInvalid,
}: AiModelComboboxProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [models, setModels] = React.useState<string[]>([]);
  const [fallbackNote, setFallbackNote] = React.useState<string | null>(null);
  const hasFetchedRef = React.useRef(false);

  // A saved profile's stored key can only be used if the draft key field is
  // blank (a non-empty draft key always means "use this instead").
  const useSavedProfile = Boolean(profileId) && !draftApiKey?.trim();

  const runFetch = React.useCallback(async (): Promise<void> => {
    setLoading(true);
    setFallbackNote(null);
    try {
      const result = useSavedProfile
        ? await listAvailableModels({ profileId: profileId as string })
        : await listAvailableModels({
            draft: {
              provider,
              apiKey: draftApiKey?.trim() || undefined,
              baseUrl: draftBaseUrl?.trim() || undefined,
            },
          });

      if (result.success) {
        setModels(result.models);
      } else {
        setModels(result.fallback);
        setFallbackNote(
          "Couldn't fetch models from provider — showing suggestions."
        );
      }
    } catch {
      setModels([...FALLBACK_MODELS[provider]]);
      setFallbackNote(
        "Couldn't fetch models from provider — showing suggestions."
      );
    } finally {
      setLoading(false);
      hasFetchedRef.current = true;
    }
  }, [useSavedProfile, profileId, provider, draftApiKey, draftBaseUrl]);

  // Model list is provider-specific — drop any cached list when the
  // provider changes so re-opening the popover fetches fresh results.
  React.useEffect(() => {
    hasFetchedRef.current = false;
    setModels([]);
    setFallbackNote(null);
  }, [provider]);

  const handleOpenChange = (next: boolean): void => {
    setOpen(next);
    if (next && !hasFetchedRef.current) {
      void runFetch();
    }
  };

  const handleRefresh = (): void => {
    void runFetch();
  };

  return (
    <div className="flex gap-1.5">
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className="border-border bg-card/30 focus:border-primary/40 flex-1 font-mono text-sm"
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        aria-invalid={ariaInvalid}
      />
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="border-border bg-card/30 hover:bg-accent hover:text-accent-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors disabled:pointer-events-none disabled:opacity-50"
            aria-label={`Browse available ${provider} models`}
          >
            <ChevronsUpDown className="text-muted-foreground h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="end">
          <Command>
            <div className="flex items-center border-b">
              <CommandInput
                placeholder="Search models…"
                aria-label="Search models"
                className="flex-1"
              />
              <button
                type="button"
                onClick={handleRefresh}
                disabled={loading}
                className="text-muted-foreground hover:text-foreground mr-2 shrink-0 rounded p-1 transition-colors disabled:opacity-50"
                aria-label="Refresh model list"
              >
                <RefreshCw
                  className={cn("h-3.5 w-3.5", loading && "animate-spin")}
                />
              </button>
            </div>
            <CommandList>
              {loading ? (
                <div className="text-muted-foreground flex items-center justify-center gap-2 py-6 text-xs">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading models…
                </div>
              ) : (
                <>
                  <CommandEmpty>
                    No matching models. Type a custom value in the field.
                  </CommandEmpty>
                  <CommandGroup>
                    {models.map((m) => (
                      <CommandItem
                        key={m}
                        value={m}
                        onSelect={() => {
                          onChange(m);
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "h-3.5 w-3.5",
                            m === value ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span className="truncate font-mono text-xs">{m}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
            {fallbackNote && !loading && (
              <div className="border-border flex items-start gap-1.5 border-t px-3 py-2 text-[11px] text-amber-600 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                <span>{fallbackNote}</span>
              </div>
            )}
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
