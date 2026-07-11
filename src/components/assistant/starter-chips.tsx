"use client";

import { motion } from "motion/react";
import {
  CalendarClock,
  Repeat,
  Scale,
  Shield,
  ShoppingBasket,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

// ---------------------------------------------------------------------------
// The 6 starter questions (docs/design/ai-assistant-ui.md §6.A)
// ---------------------------------------------------------------------------

interface StarterQuestion {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly prompt: string;
}

export const STARTER_QUESTIONS: readonly StarterQuestion[] = [
  {
    icon: ShoppingBasket,
    label: "How much did I spend on groceries last month?",
    prompt: "How much did I spend on groceries last month?",
  },
  {
    icon: TrendingUp,
    label: "Show my spending trend over the past 6 months",
    prompt: "Show me my spending trend over the past 6 months as a chart.",
  },
  {
    icon: Repeat,
    label: "What are my biggest recurring expenses?",
    prompt: "What are my biggest recurring expenses?",
  },
  {
    icon: Scale,
    label: "Am I spending more than I earn?",
    prompt: "Am I spending more than I earn? Show me my income vs expenses.",
  },
  {
    icon: Shield,
    label: "How long would my savings last?",
    prompt: "How long could my savings last without any income?",
  },
  {
    icon: CalendarClock,
    label: "Compare my weekend vs weekday spending",
    prompt: "Compare how much I spend on weekdays vs weekends.",
  },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface StarterChipsProps {
  readonly onSelect: (prompt: string) => void;
}

export function StarterChips({
  onSelect,
}: StarterChipsProps): React.JSX.Element {
  return (
    <div className="grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
      {STARTER_QUESTIONS.map((q, index) => {
        const Icon = q.icon;
        return (
          <motion.button
            key={q.label}
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.25 + index * 0.05 }}
            onClick={() => onSelect(q.prompt)}
            className="border-border bg-card text-card-foreground hover:border-primary/30 hover:bg-card/80 hover:shadow-primary/5 dark:bg-card/60 dark:hover:bg-card/80 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-left text-sm backdrop-blur-xl transition-all duration-200 hover:shadow-md"
          >
            <span className="text-primary shrink-0">
              <Icon className="h-4 w-4" />
            </span>
            <span>{q.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
