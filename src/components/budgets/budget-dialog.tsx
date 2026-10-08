"use client";

import { useState } from "react";
import { toast } from "sonner";

import { upsertBudget } from "@/actions/budgets.actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MAX_BUDGET_LIMIT } from "@/lib/db/schema";
import { formatCurrencyWhole } from "@/lib/format";
import { CATEGORIES } from "@/lib/stats/categories";

interface BudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Categories that already have a budget. */
  budgetedCategories: readonly string[];
  /** When set, the dialog edits this budget and the category is locked. */
  editing?: { category: string; monthlyLimit: number } | null;
  /** Called after a successful save. */
  onSaved: () => void;
}

/** Parses a user-entered limit (accepts "," or "." decimals). */
function parseLimit(raw: string): number {
  return Number(raw.trim().replace(",", "."));
}

/**
 * Create/edit dialog for a category budget. Only categories without a budget
 * are selectable when creating; the category is locked when editing.
 */
export function BudgetDialog(props: BudgetDialogProps) {
  // Remount the form whenever the dialog opens/targets another budget so the
  // state resets without an effect.
  const key = `${props.open}-${props.editing?.category ?? "new"}`;
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {props.open && <BudgetDialogForm key={key} {...props} />}
    </Dialog>
  );
}

function BudgetDialogForm({
  onOpenChange,
  budgetedCategories,
  editing,
  onSaved,
}: BudgetDialogProps) {
  const available = CATEGORIES.filter(
    (c) => c !== "Income" && !budgetedCategories.includes(c)
  );
  const [category, setCategory] = useState(editing?.category ?? "");
  const [limit, setLimit] = useState(
    editing ? String(editing.monthlyLimit) : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseLimit(limit);
    if (!category) return setError("Choose a category");
    if (!Number.isFinite(value) || value <= 0) {
      return setError("Limit must be greater than 0");
    }
    if (value > MAX_BUDGET_LIMIT) {
      return setError(
        `Limit cannot exceed ${formatCurrencyWhole(MAX_BUDGET_LIMIT)}`
      );
    }

    setSaving(true);
    setError(null);
    const result = await upsertBudget({
      category,
      monthlyLimit: Math.round(value * 100) / 100,
    });
    setSaving(false);

    if (!result.success) {
      setError(result.error ?? "Failed to save budget");
      return;
    }
    toast.success(`${category} budget ${editing ? "updated" : "created"}`);
    onOpenChange(false);
    onSaved();
  };

  return (
    <DialogContent className="bg-card/95 border-white/10 backdrop-blur-xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit budget" : "New budget"}</DialogTitle>
          <DialogDescription>
            Set a monthly spending limit for a category.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor="budget-category">Category</Label>
          <Select
            value={category}
            onValueChange={setCategory}
            disabled={!!editing}
          >
            <SelectTrigger id="budget-category" className="w-full">
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent className="bg-card/95 border-white/10 backdrop-blur-xl">
              {(editing ? [editing.category] : available).map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!editing && available.length === 0 && (
            <p className="text-muted-foreground text-xs">
              All categories already have a budget.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="budget-limit">Monthly limit (EUR)</Label>
          <Input
            id="budget-limit"
            inputMode="decimal"
            placeholder="e.g. 400"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            aria-invalid={!!error}
            autoComplete="off"
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save budget"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
