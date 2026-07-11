"use client";

import * as React from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AiModelCombobox } from "@/components/settings/ai-model-combobox";
import {
  MODEL_PLACEHOLDER,
  OLLAMA_DEFAULT_BASE_URL,
  PROVIDER_OPTIONS,
  previewProfileName,
} from "@/components/settings/ai-provider-constants";
import {
  saveAiProfile,
  testAiConnection,
  type AiProfileStatus,
  type SaveAiProfileInput,
} from "@/actions/ai.actions";
import type { AiProvider } from "@/config/ai";

// ---------------------------------------------------------------------------
// Add/Edit profile form. Used inline inside a Dialog by `AiProviderCard`.
//
// UX decision: "Save" persists the profile without closing the form (the
// dialog only closes when the user explicitly cancels/closes it), and "Test
// Connection" is disabled until the profile has been saved at least once —
// same precedent as the pre-v1.1 single-config card (`isConfigured` gated
// the old Test button). Testing an unsaved draft isn't supported by the
// action layer (`testAiConnection` only accepts a saved profile id), so
// requiring one Save first keeps the semantics honest instead of silently
// auto-saving on Test click.
// ---------------------------------------------------------------------------

interface AiProfileFormProps {
  initialProfile?: AiProfileStatus;
  /** Called after every successful save (create or update) — parent should refresh its profile list. */
  onSaved: (profile: AiProfileStatus, activeProfileId: string) => void;
  onClose: () => void;
}

export function AiProfileForm({
  initialProfile,
  onSaved,
  onClose,
}: AiProfileFormProps): React.JSX.Element {
  const [name, setName] = React.useState(initialProfile?.name ?? "");
  const [provider, setProvider] = React.useState<AiProvider>(
    initialProfile?.provider ?? "openai"
  );
  const [model, setModel] = React.useState(initialProfile?.model ?? "");
  const [apiKey, setApiKey] = React.useState("");
  const [apiKeyVisible, setApiKeyVisible] = React.useState(false);
  const [baseUrl, setBaseUrl] = React.useState(initialProfile?.baseUrl ?? "");
  const [touched, setTouched] = React.useState(false);

  const [savedProfileId, setSavedProfileId] = React.useState<string | null>(
    initialProfile?.id ?? null
  );
  const [keyPreview, setKeyPreview] = React.useState<string | undefined>(
    initialProfile?.keyPreview
  );

  const [isSaving, setIsSaving] = React.useState(false);
  const [isTesting, setIsTesting] = React.useState(false);
  const busy = isSaving || isTesting;

  // The provider a saved profile currently belongs to — used to decide
  // whether a provider switch should restore or discard the stored
  // key/base URL (both belong to a specific provider and never round-trip
  // across a switch, see `handleProviderChange`).
  const initialProviderRef = React.useRef(initialProfile?.provider);

  // OpenAI's Base URL field is an optional "advanced" affordance (custom
  // OpenAI-compatible endpoints like Groq/OpenRouter) — collapsed by
  // default, expanded up front only if this profile already has one saved.
  const [showAdvancedEndpoint, setShowAdvancedEndpoint] = React.useState(
    initialProfile?.provider === "ollama" ||
      (initialProfile?.provider === "openai" &&
        Boolean(initialProfile?.baseUrl))
  );

  const isOllama = provider === "ollama";
  // Anthropic/Google don't support a custom base URL in our provider
  // factory (`src/lib/ai/provider.ts`); OpenAI and Ollama do.
  const supportsBaseUrl = isOllama || provider === "openai";
  const modelEmpty = model.trim() === "";
  const apiKeyEmpty = apiKey.trim() === "";
  const hasStoredKey = Boolean(keyPreview);
  const keyRequired = !isOllama && !hasStoredKey;
  const showModelError = touched && modelEmpty;
  const showKeyError = touched && keyRequired && apiKeyEmpty;
  const canSave = !modelEmpty && !(keyRequired && apiKeyEmpty);

  const handleProviderChange = (value: string): void => {
    const next = value as AiProvider;
    if (next === provider) return;

    const isReturningToOriginal = next === initialProviderRef.current;

    setProvider(next);
    // The stored API key/base URL belong to whichever provider this profile
    // was last saved with — reapplying them to a different provider would
    // silently produce mismatched credentials/endpoint. Restore them when
    // switching back to the original provider; otherwise start clean and
    // require fresh input for the new provider.
    setKeyPreview(
      isReturningToOriginal ? initialProfile?.keyPreview : undefined
    );
    setApiKey("");
    setApiKeyVisible(false);
    setBaseUrl(isReturningToOriginal ? (initialProfile?.baseUrl ?? "") : "");
    setShowAdvancedEndpoint(
      next === "ollama" ||
        (next === "openai" &&
          isReturningToOriginal &&
          Boolean(initialProfile?.baseUrl))
    );
  };

  const handleSave = async (): Promise<void> => {
    setTouched(true);
    if (!canSave || busy) return;

    setIsSaving(true);
    try {
      const input: SaveAiProfileInput = {
        id: savedProfileId ?? undefined,
        name: name.trim() ? name.trim() : undefined,
        provider,
        model: model.trim(),
        apiKey: apiKey.trim() ? apiKey.trim() : undefined,
        // Always send the current value for providers whose base-URL field
        // is visible (blank means "explicitly clear", per `saveAiProfile`'s
        // merge-safe semantics); omit entirely for providers where the
        // field isn't rendered at all, so any existing stored value is left
        // untouched rather than silently wiped.
        baseUrl: supportsBaseUrl ? baseUrl.trim() : undefined,
      };

      const result = await saveAiProfile(input);
      if (result.success) {
        const wasCreate = !savedProfileId;
        setSavedProfileId(result.profile.id);
        setKeyPreview(result.profile.keyPreview);
        setApiKey("");
        setTouched(false);
        toast.success(wasCreate ? "Profile created" : "Profile updated", {
          description: result.profile.name,
        });
        onSaved(result.profile, result.activeProfileId);
      } else {
        toast.error("Save failed", { description: result.error });
      }
    } catch (err) {
      toast.error("Save failed", {
        description: err instanceof Error ? err.message : "Unexpected error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async (): Promise<void> => {
    if (!savedProfileId || busy) return;
    setIsTesting(true);
    try {
      const result = await testAiConnection(savedProfileId);
      if (result.success) {
        toast.success("Connection verified", {
          description: `Responded in ${result.latencyMs}ms.`,
        });
      } else {
        toast.error("Connection test failed", { description: result.error });
      }
    } catch (err) {
      toast.error("Test failed", {
        description: err instanceof Error ? err.message : "Unexpected error",
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Name */}
      <div className="space-y-1.5">
        <label
          htmlFor="ai-profile-name"
          className="text-sm leading-none font-medium"
        >
          Name
        </label>
        <Input
          id="ai-profile-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={previewProfileName(provider, model)}
          className="border-border bg-card/30 focus:border-primary/40"
          autoComplete="off"
          spellCheck={false}
        />
        <p className="text-muted-foreground text-[11px]">
          Optional &mdash; auto-generated from the provider and model if left
          blank.
        </p>
      </div>

      {/* Provider */}
      <div className="space-y-1.5">
        <label
          htmlFor="ai-profile-provider"
          className="text-sm leading-none font-medium"
        >
          Provider
        </label>
        <Select value={provider} onValueChange={handleProviderChange}>
          <SelectTrigger id="ai-profile-provider" className="w-full">
            <SelectValue placeholder="Select a provider" />
          </SelectTrigger>
          <SelectContent>
            {PROVIDER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Model */}
      <div className="space-y-1.5">
        <label
          htmlFor="ai-profile-model"
          className="text-sm leading-none font-medium"
        >
          Model{" "}
          <span className="text-destructive" aria-hidden="true">
            *
          </span>
        </label>
        <AiModelCombobox
          id="ai-profile-model"
          provider={provider}
          value={model}
          onChange={setModel}
          onBlur={() => setTouched(true)}
          profileId={savedProfileId ?? undefined}
          draftApiKey={apiKey}
          draftBaseUrl={baseUrl}
          placeholder={MODEL_PLACEHOLDER[provider]}
          aria-invalid={showModelError}
        />
        {showModelError && (
          <p role="alert" className="text-destructive text-xs">
            Model is required.
          </p>
        )}
      </div>

      {/* API Key (hidden for Ollama) */}
      {!isOllama && (
        <div className="space-y-1.5">
          <label
            htmlFor="ai-profile-key"
            className="text-sm leading-none font-medium"
          >
            API Key{" "}
            {keyRequired && (
              <span className="text-destructive" aria-hidden="true">
                *
              </span>
            )}
          </label>
          <div className="relative">
            <Input
              id="ai-profile-key"
              type={apiKeyVisible ? "text" : "password"}
              placeholder={
                hasStoredKey
                  ? "Enter a new key to replace the saved one"
                  : "sk-..."
              }
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onBlur={() => setTouched(true)}
              className="border-border bg-card/30 focus:border-primary/40 pr-10"
              autoComplete="off"
              spellCheck={false}
              data-1p-ignore
              data-lpignore="true"
              aria-required={keyRequired}
              aria-invalid={showKeyError}
            />
            <button
              type="button"
              onClick={() => setApiKeyVisible((v) => !v)}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 transition-colors"
              aria-label={apiKeyVisible ? "Hide API key" : "Show API key"}
              tabIndex={-1}
            >
              {apiKeyVisible ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
          {showKeyError && (
            <p role="alert" className="text-destructive text-xs">
              An API key is required for {provider}.
            </p>
          )}
          <p className="text-muted-foreground text-[11px]">
            {hasStoredKey
              ? `Write-only — leave blank to keep the saved key (${keyPreview}).`
              : "Write-only — never sent back to the browser once saved."}
          </p>
        </div>
      )}

      {/* Base URL (Ollama only) */}
      {isOllama && (
        <>
          <div className="space-y-1.5">
            <label
              htmlFor="ai-profile-base-url"
              className="text-sm leading-none font-medium"
            >
              Base URL
            </label>
            <Input
              id="ai-profile-base-url"
              placeholder={OLLAMA_DEFAULT_BASE_URL}
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="border-border bg-card/30 focus:border-primary/40"
              autoComplete="off"
              spellCheck={false}
            />
            <p className="text-muted-foreground text-[11px]">
              Defaults to {OLLAMA_DEFAULT_BASE_URL} when left blank.
            </p>
          </div>

          <div className="border-border bg-card/30 flex items-start gap-2 rounded-lg border p-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            <p className="text-muted-foreground text-xs leading-relaxed">
              Zero-egress when pointing at your own machine &mdash; all
              processing stays local.
            </p>
          </div>
        </>
      )}

      {/* Base URL (OpenAI only) — optional advanced custom endpoint, e.g. for
          OpenAI-compatible free providers like Groq or OpenRouter. Collapsed
          by default so it stays out of the way for the common case (plain
          OpenAI). */}
      {provider === "openai" && (
        <div className="space-y-1.5">
          {showAdvancedEndpoint ? (
            <>
              <label
                htmlFor="ai-profile-base-url"
                className="text-sm leading-none font-medium"
              >
                Base URL{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </label>
              <Input
                id="ai-profile-base-url"
                placeholder="https://api.openai.com/v1"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="border-border bg-card/30 focus:border-primary/40 font-mono text-sm"
                autoComplete="off"
                spellCheck={false}
              />
              <p className="text-muted-foreground text-[11px]">
                Leave blank to use OpenAI directly. For an OpenAI-compatible
                provider, use its API root, e.g. Groq (
                <span className="font-mono">
                  https://api.groq.com/openai/v1
                </span>
                ) or OpenRouter (
                <span className="font-mono">https://openrouter.ai/api/v1</span>
                ).
              </p>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowAdvancedEndpoint(true)}
              className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline"
            >
              Advanced: use a custom endpoint (Groq, OpenRouter, &hellip;)
            </button>
          )}
        </div>
      )}

      {/* Footer actions */}
      <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-[11px]">
          {!savedProfileId && "Save this profile to enable connection testing."}
        </p>
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={busy}
          >
            {savedProfileId ? "Close" : "Cancel"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={!savedProfileId || busy}
            className="min-w-[130px]"
          >
            {isTesting ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Testing&hellip;
              </>
            ) : (
              "Test Connection"
            )}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={busy}
            className="min-w-[80px]"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Saving&hellip;
              </>
            ) : (
              "Save"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
