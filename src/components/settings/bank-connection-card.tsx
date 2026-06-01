"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CloudOff,
  Eye,
  EyeOff,
  HelpCircle,
  Landmark,
  Loader2,
  Lock,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  getCredentialStatusAction,
  saveCredentialAction,
  testConnectionAction,
} from "@/actions/credentials.actions";
import { useSync } from "@/contexts/sync-context";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CardStatus =
  | "not-configured"
  | "configured"
  | "validating"
  | "test-success"
  | "test-failure"
  | "saving"
  | "saved"
  | "error";

// ---------------------------------------------------------------------------
// Status strip config
// ---------------------------------------------------------------------------

interface StatusConfig {
  icon: React.ElementType;
  label: string;
  detail: (extra?: string) => string;
  colorClasses: string;
  spin?: boolean;
}

function getStatusConfig(
  status: CardStatus,
  extra?: string,
  preview?: string | null
): StatusConfig {
  switch (status) {
    case "not-configured":
      return {
        icon: CloudOff,
        label: "Not connected",
        detail: () => "Paste your DKB session cookie below to get started.",
        colorClasses:
          "bg-muted/10 border-muted-foreground/20 text-muted-foreground",
      };
    case "configured":
      return {
        icon: ShieldCheck,
        label: "Session configured",
        detail: () => (preview ? `Cookie: ${preview}` : "Cookie configured"),
        colorClasses: "bg-emerald-500/10 border-emerald-500/20 text-emerald-500",
      };
    case "validating":
      return {
        icon: Loader2,
        label: "Testing connection…",
        detail: () => "Verifying your session with DKB…",
        colorClasses: "bg-amber-500/10 border-amber-500/20 text-amber-500",
        spin: true,
      };
    case "test-success":
      return {
        icon: CheckCircle2,
        label: "Connection verified",
        detail: () => "Your DKB session is active and working.",
        colorClasses: "bg-emerald-500/10 border-emerald-500/20 text-emerald-500",
      };
    case "test-failure":
      return {
        icon: XCircle,
        label: "Connection failed",
        detail: (e) => e ?? "Could not verify the session.",
        colorClasses:
          "bg-destructive/10 border-destructive/20 text-destructive",
      };
    case "saving":
      return {
        icon: Loader2,
        label: "Saving…",
        detail: () => "Writing credentials to local config…",
        colorClasses: "bg-primary/10 border-primary/20 text-primary",
        spin: true,
      };
    case "saved":
      return {
        icon: CheckCircle2,
        label: "Saved successfully",
        detail: () =>
          "Your credentials have been updated. You can now sync.",
        colorClasses: "bg-emerald-500/10 border-emerald-500/20 text-emerald-500",
      };
    case "error":
      return {
        icon: AlertTriangle,
        label: "Something went wrong",
        detail: (e) => e ?? "An unexpected error occurred.",
        colorClasses:
          "bg-destructive/10 border-destructive/20 text-destructive",
      };
  }
}

// ---------------------------------------------------------------------------
// Help steps
// ---------------------------------------------------------------------------

const HELP_STEPS = [
  {
    n: 1,
    title: "Log in to DKB",
    body: (
      <>
        Open{" "}
        <span className="font-mono text-[11px]">banking.dkb.de</span> in Chrome
        or Firefox and log in as usual.
      </>
    ),
  },
  {
    n: 2,
    title: "Open Developer Tools",
    body: (
      <>
        Press <kbd className="rounded border border-white/20 bg-white/10 px-1 py-0.5 font-mono text-[10px]">F12</kbd>{" "}
        (or right-click &rarr; Inspect), then click the{" "}
        <strong>Network</strong> tab.
      </>
    ),
  },
  {
    n: 3,
    title: "Trigger a request",
    body: "Click around inside DKB banking (e.g. open your account overview); rows appear in the Network panel.",
  },
  {
    n: 4,
    title: "Copy the cookie",
    body: (
      <>
        Click any request (e.g. one starting with{" "}
        <span className="font-mono text-[11px]">accounts</span>), find{" "}
        <strong>Request Headers</strong>, copy the entire value after{" "}
        <span className="font-mono text-[11px]">Cookie:</span>.
      </>
    ),
  },
  {
    n: 5,
    title: "Paste it here",
    body: "Return to this page, paste into the field above, then click Save.",
  },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BankConnectionCard() {
  const { refreshSyncStatus } = useSync();

  // Status machine
  const [cardStatus, setCardStatus] = React.useState<CardStatus>("not-configured");
  const [errorMessage, setErrorMessage] = React.useState<string | undefined>();
  const [preview, setPreview] = React.useState<string | null>(null);

  // Form fields
  const [cookie, setCookie] = React.useState("");
  const [xsrfToken, setXsrfToken] = React.useState("");
  const [cookieVisible, setCookieVisible] = React.useState(true);
  const [cookieTouched, setCookieTouched] = React.useState(false);

  // Collapsible state
  const [xsrfOpen, setXsrfOpen] = React.useState(false);
  const [helpOpen, setHelpOpen] = React.useState(false);

  // Independent loading for test vs save
  const [isTesting, setIsTesting] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  // Auto-transition "saved" -> "configured" after 3 s
  React.useEffect(() => {
    if (cardStatus === "saved") {
      const t = setTimeout(() => setCardStatus("configured"), 3000);
      return () => clearTimeout(t);
    }
  }, [cardStatus]);

  // Seed status from server on mount
  React.useEffect(() => {
    getCredentialStatusAction()
      .then((result) => {
        const dkb = result.dkb;
        if (dkb.configured) {
          setPreview(dkb.preview);
          setCardStatus("configured");
        } else {
          setCardStatus("not-configured");
        }
      })
      .catch(() => {
        setCardStatus("not-configured");
      });
  }, []);

  const cookieEmpty = cookie.trim() === "";
  const busy = isTesting || isSaving;

  // Validate cookie on blur / submit attempt
  const showCookieError = cookieTouched && cookieEmpty;

  // ------------------------------------------------------------------
  // Handlers
  // ------------------------------------------------------------------

  const handleTest = async () => {
    if (cookieEmpty || busy) return;
    setIsTesting(true);
    setCardStatus("validating");
    setErrorMessage(undefined);

    try {
      const result = await testConnectionAction({
        cookie: cookie.trim(),
        xsrfToken: xsrfToken.trim() || undefined,
      });

      if (result.success) {
        setCardStatus("test-success");
        toast.success("Connection verified", {
          description: `Found ${result.accountCount} account${result.accountCount === 1 ? "" : "s"} on your DKB profile.`,
        });
      } else {
        setCardStatus("test-failure");
        setErrorMessage(result.error);
        toast.error("Connection test failed", { description: result.error });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unexpected error";
      setCardStatus("error");
      setErrorMessage(msg);
      toast.error("Test failed", { description: msg });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    setCookieTouched(true);
    if (cookieEmpty || busy) return;
    setIsSaving(true);
    setCardStatus("saving");
    setErrorMessage(undefined);

    try {
      const result = await saveCredentialAction({
        institution: "dkb",
        cookie: cookie.trim(),
        xsrfToken: xsrfToken.trim() || undefined,
      });

      if (result.success) {
        setCardStatus("saved");
        setCookie("");
        setXsrfToken("");
        setCookieTouched(false);
        toast.success("Bank connection saved", {
          description: "You can now sync your accounts.",
        });
        // Refresh sync context so hasCredentials updates
        await refreshSyncStatus();
        // Re-fetch preview
        getCredentialStatusAction()
          .then((r) => setPreview(r.dkb.preview))
          .catch(() => {});
      } else {
        setCardStatus("error");
        setErrorMessage(result.error);
        toast.error("Save failed", { description: result.error });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unexpected error";
      setCardStatus("error");
      setErrorMessage(msg);
      toast.error("Save failed", { description: msg });
    } finally {
      setIsSaving(false);
    }
  };

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  const cfg = getStatusConfig(cardStatus, errorMessage, preview);
  const StatusIcon = cfg.icon;

  return (
    <Card className="border-primary/10 relative overflow-hidden">
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-primary/5 opacity-50" />

      {/* All content sits above the overlay */}
      <div className="relative z-10">
        {/* Header */}
        <CardHeader className="p-6">
          <CardTitle className="flex items-center gap-2 text-base">
            <Landmark className="text-primary h-5 w-5" />
            Bank Connection
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            Connect your DKB account to sync transactions automatically.
          </p>
        </CardHeader>

        {/* Status strip */}
        <div className="px-6 pb-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={cardStatus}
              role="status"
              aria-live="polite"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3",
                cfg.colorClasses
              )}
            >
              <StatusIcon
                className={cn("mt-0.5 h-4 w-4 shrink-0", cfg.spin && "animate-spin")}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-tight">{cfg.label}</p>
                <p
                  className={cn(
                    "mt-0.5 text-xs leading-relaxed",
                    cardStatus === "configured"
                      ? "font-mono"
                      : "opacity-80"
                  )}
                >
                  {cfg.detail(errorMessage)}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Form */}
        <CardContent className="space-y-5 px-6 pt-0">
          {/* Session Cookie */}
          <div className="space-y-1.5">
            <label
              htmlFor="dkb-cookie"
              className="text-sm font-medium leading-none"
            >
              Session Cookie{" "}
              <span className="text-destructive" aria-hidden="true">
                *
              </span>
            </label>

            <div className="relative">
              <Textarea
                id="dkb-cookie"
                rows={4}
                placeholder="Paste your DKB session cookie here…"
                value={cookie}
                onChange={(e) => {
                  setCookie(e.target.value);
                  if (e.target.value.trim()) setCookieTouched(false);
                }}
                onBlur={() => setCookieTouched(true)}
                className={cn(
                  "resize-none pr-10 font-mono text-xs",
                  "bg-card/30 border-white/10 focus:border-primary/40 dark:border-white/5"
                )}
                style={
                  cookieVisible
                    ? undefined
                    : ({ WebkitTextSecurity: "disc" } as React.CSSProperties)
                }
                autoComplete="off"
                spellCheck={false}
                data-1p-ignore
                data-lpignore="true"
                aria-required="true"
                aria-invalid={showCookieError ? true : undefined}
                aria-describedby={showCookieError ? "cookie-error" : undefined}
              />
              {/* Eye toggle */}
              <button
                type="button"
                onClick={() => setCookieVisible((v) => !v)}
                className="text-muted-foreground hover:text-foreground absolute top-2 right-2 rounded p-1 transition-colors"
                aria-label={cookieVisible ? "Hide cookie" : "Show cookie"}
                tabIndex={-1}
              >
                {cookieVisible ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </button>
            </div>

            {showCookieError && (
              <p
                id="cookie-error"
                role="alert"
                className="text-destructive text-xs"
              >
                Session cookie is required.
              </p>
            )}

            <p className="text-muted-foreground text-[11px]">
              Write-only — the field is empty on load even when a cookie is
              already saved.
            </p>
          </div>

          {/* XSRF token collapsible */}
          <Collapsible open={xsrfOpen} onOpenChange={setXsrfOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs font-medium transition-colors"
              >
                <ChevronRight
                  className={cn(
                    "h-3.5 w-3.5 transition-transform duration-200",
                    xsrfOpen && "rotate-90"
                  )}
                />
                Advanced: XSRF Token (optional)
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-1 data-[state=open]:slide-in-from-top-1">
              <div className="mt-2 space-y-1.5">
                <label
                  htmlFor="dkb-xsrf"
                  className="text-sm font-medium leading-none"
                >
                  XSRF Token
                </label>
                <Input
                  id="dkb-xsrf"
                  value={xsrfToken}
                  onChange={(e) => setXsrfToken(e.target.value)}
                  placeholder="Optional XSRF token"
                  className="bg-card/30 border-white/10 font-mono text-xs dark:border-white/5"
                  autoComplete="off"
                  spellCheck={false}
                />
                <p className="text-muted-foreground text-[11px]">
                  Only required if DKB&rsquo;s API rejects requests without it.
                  Most users can skip this.
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Help collapsible */}
          <Collapsible open={helpOpen} onOpenChange={setHelpOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs font-medium transition-colors"
              >
                <HelpCircle className="h-3.5 w-3.5 shrink-0" />
                How do I get my session cookie?
                <ChevronRight
                  className={cn(
                    "h-3.5 w-3.5 transition-transform duration-200",
                    helpOpen && "rotate-90"
                  )}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-1 data-[state=open]:slide-in-from-top-1">
              <div className="mt-3 rounded-lg border border-white/10 bg-card/30 p-4 backdrop-blur-sm dark:border-white/5">
                <div className="space-y-4">
                  {HELP_STEPS.map((step) => (
                    <div key={step.n} className="flex gap-3">
                      <span className="bg-primary/10 text-primary flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold">
                        {step.n}
                      </span>
                      <div className="text-xs leading-relaxed">
                        <span className="text-foreground font-semibold">
                          {step.title}
                        </span>{" "}
                        &mdash; <span className="text-muted-foreground">{step.body}</span>
                      </div>
                    </div>
                  ))}

                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    These steps work in Chrome, Firefox, and Edge. The cookie
                    usually stays valid for a few hours. When it expires, repeat
                    these steps and paste a fresh one.
                  </p>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>

        {/* Footer */}
        <CardFooter className="flex-col gap-3 p-6 pt-2 sm:flex-row sm:items-center sm:justify-between">
          {/* Lock note */}
          <p className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
            <Lock className="h-3 w-3 shrink-0" />
            Stored locally &mdash; never sent anywhere except DKB.
          </p>

          {/* Action buttons */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* Test Connection */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={cookieEmpty || busy}
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

            {/* Save */}
            <Button
              size="sm"
              onClick={handleSave}
              disabled={cookieEmpty || busy}
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
        </CardFooter>
      </div>
    </Card>
  );
}
