"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  CloudOff,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
  ShieldQuestion,
  XCircle,
  Loader2,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getAiConfigStatus,
  saveAiConfig,
  testAiConnection,
} from "@/actions/ai.actions";
import type { AiProvider } from "@/config/ai";

// ---------------------------------------------------------------------------
// Static provider metadata
// ---------------------------------------------------------------------------

const PROVIDER_OPTIONS: ReadonlyArray<{ value: AiProvider; label: string }> = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "google", label: "Google" },
  { value: "ollama", label: "Ollama (local)" },
];

const MODEL_PLACEHOLDER: Record<AiProvider, string> = {
  openai: "gpt-4o",
  anthropic: "claude-sonnet-4-5",
  google: "gemini-2.5-flash",
  ollama: "llama3.1",
};

const OLLAMA_DEFAULT_BASE_URL = "http://localhost:11434";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CardStatus =
  | "not-configured"
  | "configured"
  | "testing"
  | "test-success"
  | "test-failure"
  | "saving"
  | "saved"
  | "error";

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
  provider?: string,
  model?: string,
  keyPreview?: string
): StatusConfig {
  switch (status) {
    case "not-configured":
      return {
        icon: CloudOff,
        label: "Not configured",
        detail: () => "Choose a provider and model to enable the AI assistant.",
        colorClasses:
          "bg-muted/10 border-muted-foreground/20 text-muted-foreground",
      };
    case "configured":
      return {
        icon: ShieldCheck,
        label: "Provider configured",
        detail: () =>
          `${provider ?? "Provider"} · ${model ?? "model"}${keyPreview ? ` · ${keyPreview}` : ""}`,
        colorClasses:
          "bg-emerald-500/10 border-emerald-500/20 text-emerald-500",
      };
    case "testing":
      return {
        icon: Loader2,
        label: "Testing connection…",
        detail: () => "Sending a minimal request to verify access…",
        colorClasses: "bg-amber-500/10 border-amber-500/20 text-amber-500",
        spin: true,
      };
    case "test-success":
      return {
        icon: CheckCircle2,
        label: "Connection verified",
        detail: () => "The AI provider responded successfully.",
        colorClasses:
          "bg-emerald-500/10 border-emerald-500/20 text-emerald-500",
      };
    case "test-failure":
      return {
        icon: XCircle,
        label: "Connection failed",
        detail: (e) => e ?? "Could not verify the connection.",
        colorClasses:
          "bg-destructive/10 border-destructive/20 text-destructive",
      };
    case "saving":
      return {
        icon: Loader2,
        label: "Saving…",
        detail: () => "Writing configuration to local config…",
        colorClasses: "bg-primary/10 border-primary/20 text-primary",
        spin: true,
      };
    case "saved":
      return {
        icon: CheckCircle2,
        label: "Saved successfully",
        detail: () => "Your AI configuration has been updated.",
        colorClasses:
          "bg-emerald-500/10 border-emerald-500/20 text-emerald-500",
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
// Component
// ---------------------------------------------------------------------------

export function AiProviderCard() {
  const [cardStatus, setCardStatus] =
    React.useState<CardStatus>("not-configured");
  const [errorMessage, setErrorMessage] = React.useState<string | undefined>();
  const [savedProvider, setSavedProvider] = React.useState<
    string | undefined
  >();
  const [savedModel, setSavedModel] = React.useState<string | undefined>();
  const [keyPreview, setKeyPreview] = React.useState<string | undefined>();
  const [isConfigured, setIsConfigured] = React.useState(false);

  // Form fields
  const [provider, setProvider] = React.useState<AiProvider>("openai");
  const [model, setModel] = React.useState("");
  const [apiKey, setApiKey] = React.useState("");
  const [apiKeyVisible, setApiKeyVisible] = React.useState(false);
  const [baseUrl, setBaseUrl] = React.useState("");
  const [touched, setTouched] = React.useState(false);

  const [isTesting, setIsTesting] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const busy = isTesting || isSaving;

  const isOllama = provider === "ollama";
  const modelEmpty = model.trim() === "";
  const apiKeyEmpty = apiKey.trim() === "";
  const showValidation = touched && (modelEmpty || (!isOllama && apiKeyEmpty));

  // Auto-transition "saved" -> "configured" after 3s
  React.useEffect(() => {
    if (cardStatus === "saved") {
      const t = setTimeout(() => setCardStatus("configured"), 3000);
      return () => clearTimeout(t);
    }
  }, [cardStatus]);

  // Seed status + non-secret fields from server on mount
  React.useEffect(() => {
    getAiConfigStatus()
      .then((result) => {
        setIsConfigured(result.configured);
        if (result.configured) {
          setSavedProvider(result.provider);
          setSavedModel(result.model);
          setKeyPreview(result.keyPreview);
          setCardStatus("configured");
          if (result.provider) {
            setProvider(result.provider as AiProvider);
          }
          if (result.model) {
            setModel(result.model);
          }
        } else {
          setCardStatus("not-configured");
        }
      })
      .catch(() => {
        setCardStatus("not-configured");
      });
  }, []);

  // ------------------------------------------------------------------
  // Handlers
  // ------------------------------------------------------------------

  const handleSave = async () => {
    setTouched(true);
    if (modelEmpty || (!isOllama && apiKeyEmpty) || busy) return;

    setIsSaving(true);
    setCardStatus("saving");
    setErrorMessage(undefined);

    try {
      const result = await saveAiConfig({
        provider,
        model: model.trim(),
        apiKey: isOllama ? undefined : apiKey.trim(),
        baseUrl: isOllama ? baseUrl.trim() || undefined : undefined,
      });

      if (result.success) {
        setCardStatus("saved");
        setApiKey("");
        setTouched(false);
        toast.success("AI configuration saved", {
          description: "You can now test the connection.",
        });

        const refreshed = await getAiConfigStatus();
        setIsConfigured(refreshed.configured);
        setSavedProvider(refreshed.provider);
        setSavedModel(refreshed.model);
        setKeyPreview(refreshed.keyPreview);
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

  const handleTest = async () => {
    if (!isConfigured || busy) return;
    setIsTesting(true);
    setCardStatus("testing");
    setErrorMessage(undefined);

    try {
      const result = await testAiConnection();
      if (result.success) {
        setCardStatus("test-success");
        toast.success("Connection verified", {
          description: `Responded in ${result.latencyMs}ms.`,
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

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  const cfg = getStatusConfig(
    cardStatus,
    errorMessage,
    savedProvider,
    savedModel,
    keyPreview
  );
  const StatusIcon = cfg.icon;

  return (
    <Card className="border-primary/10 relative overflow-hidden">
      <div className="to-primary/5 absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent opacity-50" />

      <div className="relative z-10">
        {/* Header */}
        <CardHeader className="p-6">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="text-primary h-5 w-5" />
            AI Assistant
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            Connect an AI provider to power the assistant. Bring your own API
            key, or run a fully local model with Ollama.
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
                className={cn(
                  "mt-0.5 h-4 w-4 shrink-0",
                  cfg.spin && "animate-spin"
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-tight font-medium">{cfg.label}</p>
                <p
                  className={cn(
                    "mt-0.5 text-xs leading-relaxed",
                    cardStatus === "configured" ? "font-mono" : "opacity-80"
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
          {/* Provider */}
          <div className="space-y-1.5">
            <label
              htmlFor="ai-provider"
              className="text-sm leading-none font-medium"
            >
              Provider
            </label>
            <Select
              value={provider}
              onValueChange={(value) => setProvider(value as AiProvider)}
            >
              <SelectTrigger id="ai-provider" className="w-full">
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
              htmlFor="ai-model"
              className="text-sm leading-none font-medium"
            >
              Model{" "}
              <span className="text-destructive" aria-hidden="true">
                *
              </span>
            </label>
            <Input
              id="ai-model"
              placeholder={MODEL_PLACEHOLDER[provider]}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              onBlur={() => setTouched(true)}
              className="border-border bg-card/30 focus:border-primary/40"
              autoComplete="off"
              spellCheck={false}
              aria-required="true"
              aria-invalid={showValidation && modelEmpty ? true : undefined}
            />
            {showValidation && modelEmpty && (
              <p role="alert" className="text-destructive text-xs">
                Model is required.
              </p>
            )}
          </div>

          {/* API Key (hidden for Ollama) */}
          {!isOllama && (
            <div className="space-y-1.5">
              <label
                htmlFor="ai-api-key"
                className="text-sm leading-none font-medium"
              >
                API Key{" "}
                <span className="text-destructive" aria-hidden="true">
                  *
                </span>
              </label>
              <div className="relative">
                <Input
                  id="ai-api-key"
                  type={apiKeyVisible ? "text" : "password"}
                  placeholder={
                    isConfigured && provider === savedProvider
                      ? "Enter a new key to replace the saved one"
                      : "Paste your API key"
                  }
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  onBlur={() => setTouched(true)}
                  className="border-border bg-card/30 focus:border-primary/40 pr-10"
                  autoComplete="off"
                  spellCheck={false}
                  data-1p-ignore
                  data-lpignore="true"
                  aria-required="true"
                  aria-invalid={
                    showValidation && apiKeyEmpty ? true : undefined
                  }
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
              {showValidation && apiKeyEmpty && (
                <p role="alert" className="text-destructive text-xs">
                  API key is required for {provider}.
                </p>
              )}
              <p className="text-muted-foreground text-[11px]">
                Write-only &mdash; the field is empty on load even when a key is
                already saved.
              </p>
            </div>
          )}

          {/* Base URL (Ollama only) */}
          {isOllama && (
            <>
              <div className="space-y-1.5">
                <label
                  htmlFor="ai-base-url"
                  className="text-sm leading-none font-medium"
                >
                  Base URL
                </label>
                <Input
                  id="ai-base-url"
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
                <ShieldQuestion className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Fully private &mdash; all processing stays on your machine.
                </p>
              </div>
            </>
          )}
        </CardContent>

        {/* Footer */}
        <CardFooter className="flex-col gap-3 p-6 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
            <Lock className="h-3 w-3 shrink-0" />
            Stored locally &mdash; only sent to your chosen provider.
          </p>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={!isConfigured || busy}
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
        </CardFooter>
      </div>
    </Card>
  );
}
