"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Bot,
  CloudOff,
  Loader2,
  Lock,
  Pencil,
  Plus,
  PlugZap,
  Trash2,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AiProfileForm } from "@/components/settings/ai-profile-form";
import {
  PROVIDER_ICONS,
  PROVIDER_LABELS,
} from "@/components/settings/ai-provider-constants";
import {
  deleteAiProfile,
  getAiProfilesStatus,
  setActiveAiProfile,
  testAiConnection,
  type AiProfileStatus,
} from "@/actions/ai.actions";

// ---------------------------------------------------------------------------
// Dialog state
// ---------------------------------------------------------------------------

type DialogState =
  | { mode: "create" }
  | { mode: "edit"; profile: AiProfileStatus }
  | null;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AiProviderCard(): React.JSX.Element {
  const [profiles, setProfiles] = React.useState<AiProfileStatus[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [dialogState, setDialogState] = React.useState<DialogState>(null);
  const [pendingDelete, setPendingDelete] =
    React.useState<AiProfileStatus | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [switchingId, setSwitchingId] = React.useState<string | null>(null);
  const [testingId, setTestingId] = React.useState<string | null>(null);

  const refresh = React.useCallback(async (): Promise<void> => {
    try {
      const status = await getAiProfilesStatus();
      setProfiles(status.profiles);
    } catch (err) {
      toast.error("Failed to load AI profiles", {
        description: err instanceof Error ? err.message : "Unexpected error",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleSetActive = async (profile: AiProfileStatus): Promise<void> => {
    if (profile.isActive || switchingId) return;
    setSwitchingId(profile.id);
    try {
      const result = await setActiveAiProfile(profile.id);
      if (result.success) {
        await refresh();
        toast.success("Active profile switched", {
          description: profile.name,
        });
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

  const handleTestRow = async (profile: AiProfileStatus): Promise<void> => {
    if (testingId) return;
    setTestingId(profile.id);
    try {
      const result = await testAiConnection(profile.id);
      if (result.success) {
        toast.success("Connection verified", {
          description: `${profile.name} responded in ${result.latencyMs}ms.`,
        });
      } else {
        toast.error("Connection test failed", { description: result.error });
      }
    } catch (err) {
      toast.error("Test failed", {
        description: err instanceof Error ? err.message : "Unexpected error",
      });
    } finally {
      setTestingId(null);
    }
  };

  const handleDeleteConfirm = async (): Promise<void> => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      const result = await deleteAiProfile(pendingDelete.id);
      if (result.success) {
        toast.success("Profile deleted", { description: pendingDelete.name });
        setPendingDelete(null);
        await refresh();
      } else {
        // Surfaces the action's own guard messages verbatim (e.g. "Cannot
        // delete the only remaining AI profile...").
        toast.error("Could not delete profile", { description: result.error });
      }
    } catch (err) {
      toast.error("Could not delete profile", {
        description: err instanceof Error ? err.message : "Unexpected error",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <>
      <Card className="border-border relative overflow-hidden">
        <div className="to-primary/5 absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent opacity-50" />

        <div className="relative z-10">
          <CardHeader className="p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1.5">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bot className="text-primary h-5 w-5" />
                  AI Assistant
                </CardTitle>
                <p className="text-muted-foreground text-sm">
                  Connect one or more AI providers to power the assistant. Bring
                  your own API key, or run a fully local model with Ollama.
                </p>
              </div>
              {profiles.length > 0 && (
                <Button
                  size="sm"
                  onClick={() => setDialogState({ mode: "create" })}
                  className="shrink-0"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Add Profile</span>
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="px-6 pt-0 pb-4">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
              </div>
            )}

            {!loading && profiles.length === 0 && (
              <div className="border-border flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
                <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-xl">
                  <CloudOff className="text-muted-foreground h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    No AI provider configured
                  </p>
                  <p className="text-muted-foreground max-w-xs text-xs">
                    Add a provider profile to enable the AI Assistant. Bring
                    your own API key, or run a fully local model with Ollama.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => setDialogState({ mode: "create" })}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add Profile
                </Button>
              </div>
            )}

            {!loading && profiles.length > 0 && (
              <ul className="space-y-2" role="list" aria-label="AI profiles">
                {profiles.map((profile) => {
                  const ProviderIcon = PROVIDER_ICONS[profile.provider];
                  const isRowBusy =
                    switchingId === profile.id || testingId === profile.id;

                  return (
                    <li
                      key={profile.id}
                      className={
                        "border-border flex items-center gap-3 rounded-lg border p-4 " +
                        (profile.isActive ? "bg-primary/5" : "bg-card/30")
                      }
                    >
                      <div className="bg-primary/10 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                        <ProviderIcon className="text-primary h-4 w-4" />
                      </div>

                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium">
                            {profile.name}
                          </p>
                          {profile.isActive && (
                            <Badge variant="secondary" className="text-[10px]">
                              Active
                            </Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground truncate font-mono text-xs">
                          {PROVIDER_LABELS[profile.provider]} &middot;{" "}
                          {profile.model}
                          {profile.keyPreview ? ` · ${profile.keyPreview}` : ""}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        {!profile.isActive && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleSetActive(profile)}
                            disabled={isRowBusy}
                            className="hidden sm:inline-flex"
                          >
                            {switchingId === profile.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              "Set active"
                            )}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => void handleTestRow(profile)}
                          disabled={isRowBusy}
                          aria-label={`Test connection for ${profile.name}`}
                        >
                          {testingId === profile.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <PlugZap className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() =>
                            setDialogState({ mode: "edit", profile })
                          }
                          aria-label={`Edit ${profile.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setPendingDelete(profile)}
                          disabled={profiles.length <= 1}
                          aria-label={`Delete ${profile.name}`}
                          title={
                            profiles.length <= 1
                              ? "At least one AI profile is required"
                              : undefined
                          }
                          className="hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>

          <CardFooter className="p-6 pt-2">
            <p className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
              <Lock className="h-3 w-3 shrink-0" />
              Stored locally &mdash; only sent to the provider you choose.
            </p>
          </CardFooter>
        </div>
      </Card>

      {/* Add/Edit dialog */}
      <Dialog
        open={dialogState !== null}
        onOpenChange={(open) => {
          if (!open) setDialogState(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialogState?.mode === "edit"
                ? "Edit AI Profile"
                : "Add AI Profile"}
            </DialogTitle>
            <DialogDescription>
              Connect an AI provider with your own API key, or run a fully local
              model with Ollama.
            </DialogDescription>
          </DialogHeader>
          {dialogState && (
            <AiProfileForm
              key={
                dialogState.mode === "edit" ? dialogState.profile.id : "create"
              }
              initialProfile={
                dialogState.mode === "edit" ? dialogState.profile : undefined
              }
              onSaved={() => {
                void refresh();
              }}
              onClose={() => setDialogState(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete &ldquo;{pendingDelete?.name}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes the saved profile and its API key from local config.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isDeleting}
              onClick={() => setPendingDelete(null)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={() => void handleDeleteConfirm()}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Deleting&hellip;
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
