"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, ChevronDown, Loader2, Settings } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setActiveAiProfile, type AiProfileStatus } from "@/actions/ai.actions";

// ---------------------------------------------------------------------------
// Quick profile switcher for the /assistant header.
//
// Falls back to the plain static model badge when there are fewer than 2
// profiles (nothing to switch between) — visually identical to the previous
// single-config badge, so this is a no-op change for single-profile setups.
// ---------------------------------------------------------------------------

interface ProfileSwitcherProps {
  profiles: AiProfileStatus[];
  onSwitched: () => void | Promise<void>;
}

export function ProfileSwitcher({
  profiles,
  onSwitched,
}: ProfileSwitcherProps): React.JSX.Element {
  const [switchingId, setSwitchingId] = React.useState<string | null>(null);
  const activeProfile = profiles.find((p) => p.isActive) ?? profiles[0];

  if (profiles.length < 2) {
    return (
      <Badge
        variant="secondary"
        className="hidden font-mono text-[11px] md:inline-flex"
      >
        {activeProfile?.model ?? "Not configured"}
      </Badge>
    );
  }

  const handleSwitch = async (profile: AiProfileStatus): Promise<void> => {
    if (profile.isActive || switchingId) return;
    setSwitchingId(profile.id);
    try {
      const result = await setActiveAiProfile(profile.id);
      if (result.success) {
        toast.success("Switched AI profile", { description: profile.name });
        await onSwitched();
      } else {
        toast.error("Could not switch profile", { description: result.error });
      }
    } catch (err) {
      toast.error("Could not switch profile", {
        description: err instanceof Error ? err.message : "Unexpected error",
      });
    } finally {
      setSwitchingId(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="hidden h-auto gap-1 px-2 py-1 md:inline-flex"
          aria-label={`Switch AI profile (current: ${activeProfile?.name ?? "none"})`}
        >
          <Badge variant="secondary" className="font-mono text-[11px]">
            {activeProfile?.model ?? "Not configured"}
          </Badge>
          {switchingId ? (
            <Loader2 className="text-muted-foreground h-3 w-3 animate-spin" />
          ) : (
            <ChevronDown className="text-muted-foreground h-3 w-3" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
          AI Profile
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {profiles.map((profile) => (
          <DropdownMenuItem
            key={profile.id}
            onSelect={() => void handleSwitch(profile)}
            disabled={switchingId !== null}
            className="flex items-center gap-2"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{profile.name}</p>
              <p className="text-muted-foreground truncate font-mono text-[10px]">
                {profile.model}
              </p>
            </div>
            {profile.isActive && <Check className="h-3.5 w-3.5 shrink-0" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings" className="flex items-center gap-2">
            <Settings className="h-3.5 w-3.5" />
            Manage profiles
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
