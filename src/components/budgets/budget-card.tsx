"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteBudget } from "@/actions/budgets.actions";
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
import { Card } from "@/components/ui/card";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { BudgetProgress, BudgetStatus } from "@/lib/stats/budgets";
import { cn } from "@/lib/utils";

import { BudgetProgressBar } from "./budget-progress-bar";
import { CategoryIcon } from "./category-icon";

/** Badge label and classes per budget status. */
const STATUS_BADGE: Record<BudgetStatus, { label: string; className: string }> =
  {
    ok: {
      label: "On track",
      className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    },
    warning: {
      label: "Near limit",
      className: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    },
    over: {
      label: "Over budget",
      className: "border-red-500/30 bg-red-500/10 text-red-400",
    },
  };

interface BudgetCardProps {
  progress: BudgetProgress;
  onEdit: (progress: BudgetProgress) => void;
  /** Called after a successful delete so the parent can reload. */
  onDeleted: () => void;
}

/**
 * Card for one monthly category budget: spent vs limit, remaining, status,
 * projection, and edit/delete actions (delete asks for confirmation).
 */
export function BudgetCard({ progress, onEdit, onDeleted }: BudgetCardProps) {
  const { budget, spent, remaining, percentUsed, status } = progress;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const badge = STATUS_BADGE[status];
  const projectedPercent =
    budget.monthlyLimit > 0
      ? (progress.projectedMonthEnd / budget.monthlyLimit) * 100
      : 0;

  const handleDelete = async () => {
    setDeleting(true);
    const result = await deleteBudget(budget.id);
    setDeleting(false);
    if (result.success) {
      toast.success(`${budget.category} budget deleted`);
      setConfirmOpen(false);
      onDeleted();
    } else {
      toast.error(result.error ?? "Failed to delete budget");
    }
  };

  return (
    <Card className="bg-card/70 flex flex-col gap-4 border-white/10 p-6 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-lg">
            <CategoryIcon category={budget.category} />
          </div>
          <div>
            <h3 className="font-semibold">{budget.category}</h3>
            <Badge variant="outline" className={cn("mt-1", badge.className)}>
              {badge.label}
            </Badge>
          </div>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Edit ${budget.category} budget`}
            onClick={() => onEdit(progress)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Delete ${budget.category} budget`}
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <p className="text-2xl font-bold tabular-nums">
          {formatCurrency(spent)}
          <span className="text-muted-foreground text-sm font-normal">
            {" "}
            / {formatCurrency(budget.monthlyLimit)}
          </span>
        </p>
        <span className="text-muted-foreground text-sm tabular-nums">
          {formatPercent(percentUsed)}
        </span>
      </div>

      <BudgetProgressBar
        percentUsed={percentUsed}
        status={status}
        projectedPercent={projectedPercent}
        label={`${budget.category} budget usage`}
      />

      <div className="flex flex-col gap-1 text-sm">
        <p
          className={cn(
            remaining < 0 ? "text-red-400" : "text-muted-foreground"
          )}
        >
          {remaining < 0
            ? `Over by ${formatCurrency(Math.abs(remaining))}`
            : `${formatCurrency(remaining)} remaining`}
        </p>
        <p className="text-muted-foreground text-xs">
          Projected month-end: {formatCurrency(progress.projectedMonthEnd)}
          {progress.projectedStatus === "over" && status !== "over" && (
            <span className="text-amber-400"> (on pace to exceed)</span>
          )}
        </p>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {budget.category} budget?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes the monthly limit of{" "}
              {formatCurrency(budget.monthlyLimit)}. Your transactions are not
              affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
