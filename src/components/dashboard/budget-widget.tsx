"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PiggyBank } from "lucide-react";

import { getBudgetProgress } from "@/actions/budgets.actions";
import { BudgetProgressBar } from "@/components/budgets/budget-progress-bar";
import { CategoryIcon } from "@/components/budgets/category-icon";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDemoMode } from "@/contexts/demo-context";
import { formatCurrencyWhole, formatPercent } from "@/lib/format";
import type { BudgetProgress } from "@/lib/stats/budgets";
import { cn } from "@/lib/utils";

/**
 * Compact dashboard card showing the three most-used budgets of the month
 * with mini progress bars, or an empty state linking to budget creation.
 */
export function BudgetWidget({ className }: { className?: string }) {
  const { isDemoMode } = useDemoMode();
  const [items, setItems] = useState<BudgetProgress[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getBudgetProgress()
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((err) => {
        console.error("Failed to load budget widget:", err);
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isDemoMode]);

  const top = (items ?? []).slice(0, 3);

  return (
    <Card
      className={cn(
        "bg-card/70 gap-4 border-white/10 p-6 backdrop-blur-xl",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Budgets</h3>
        <Link href="/budgets" className="text-primary text-sm hover:underline">
          View all
        </Link>
      </div>

      {items === null ? (
        <div className="flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : top.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center gap-2 py-4 text-center text-sm">
          <PiggyBank className="h-8 w-8" aria-hidden />
          <p>No budgets yet.</p>
          <Link href="/budgets" className="text-primary hover:underline">
            Create a budget
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {top.map((p) => (
            <li key={p.budget.id} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2 font-medium">
                  <CategoryIcon category={p.budget.category} />
                  {p.budget.category}
                </span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {formatCurrencyWhole(p.spent)} /{" "}
                  {formatCurrencyWhole(p.budget.monthlyLimit)} ·{" "}
                  {formatPercent(p.percentUsed)}
                </span>
              </div>
              <BudgetProgressBar
                percentUsed={p.percentUsed}
                status={p.status}
                label={`${p.budget.category} budget usage`}
                className="[&_[data-slot=progress]]:h-1.5"
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
