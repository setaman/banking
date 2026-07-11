"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  BotMessageSquare,
  DatabaseZap,
  Landmark,
  Settings,
} from "lucide-react";

import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Blocking state B — AI provider not configured
// (docs/design/ai-assistant-ui.md §6.B)
// ---------------------------------------------------------------------------

export function AiNotConfiguredState(): React.JSX.Element {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="bg-muted mb-6 flex h-16 w-16 items-center justify-center rounded-2xl"
      >
        <BotMessageSquare className="text-muted-foreground h-8 w-8" />
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
        className="text-foreground mb-2 text-center text-xl font-semibold"
      >
        Set up your AI provider
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.2 }}
        className="text-muted-foreground mb-6 max-w-md text-center text-sm"
      >
        To use the AI Assistant, configure an API key and model in Settings.
        Your data stays local — the AI only sees what you ask about.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.25 }}
      >
        <Button asChild>
          <Link href="/settings">
            <Settings className="mr-2 h-4 w-4" />
            Go to Settings
          </Link>
        </Button>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Blocking state C — no transaction data yet
// (docs/design/ai-assistant-ui.md §6.C)
// ---------------------------------------------------------------------------

export function NoTransactionDataState(): React.JSX.Element {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="bg-muted mb-6 flex h-16 w-16 items-center justify-center rounded-2xl"
      >
        <DatabaseZap className="text-muted-foreground h-8 w-8" />
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
        className="text-foreground mb-2 text-center text-xl font-semibold"
      >
        No financial data yet
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.2 }}
        className="text-muted-foreground mb-6 max-w-md text-center text-sm"
      >
        Sync your bank account first so the assistant has something to analyze.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.25 }}
      >
        <Button asChild variant="outline">
          <Link href="/settings">
            <Landmark className="mr-2 h-4 w-4" />
            Connect your bank
          </Link>
        </Button>
      </motion.div>
    </div>
  );
}
