"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";

import { getBudgetProgress } from "@/actions/budgets.actions";
import { BudgetDialog } from "@/components/budgets/budget-dialog";
import { BudgetList } from "@/components/budgets/budget-list";
import { BudgetSummary } from "@/components/budgets/budget-summary";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDemoMode } from "@/contexts/demo-context";
import type { BudgetProgress } from "@/lib/stats/budgets";

/** Monthly category budgets: summary, per-category progress, CRUD. */
export default function BudgetsPage() {
  const { isDemoMode } = useDemoMode();
  const [items, setItems] = useState<BudgetProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetProgress | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setItems(await getBudgetProgress());
    } catch (err) {
      console.error("Failed to load budgets:", err);
      setError("Failed to load budgets");
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload on mount and whenever demo mode toggles.
  useEffect(() => {
    void load();
  }, [load, isDemoMode]);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (progress: BudgetProgress) => {
    setEditing(progress);
    setDialogOpen(true);
  };

  return (
    <DashboardShell>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-glow text-4xl font-bold tracking-tight">
            <span className="from-foreground to-foreground/50 bg-gradient-to-r bg-clip-text text-transparent">
              Budgets
            </span>
          </h1>
          <p className="text-muted-foreground">
            Monthly spending limits per category, tracked against this
            month&apos;s transactions.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New budget
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-56 w-full rounded-xl" />
            ))}
          </div>
        </div>
      ) : error ? (
        <Card className="bg-card/70 items-center gap-4 border-red-500/20 p-6 backdrop-blur-xl">
          <p className="text-red-400">{error}</p>
          <Button variant="outline" onClick={() => void load()}>
            Retry
          </Button>
        </Card>
      ) : (
        <>
          {items.length > 0 && <BudgetSummary items={items} />}
          <BudgetList
            items={items}
            onCreate={openCreate}
            onEdit={openEdit}
            onChanged={() => void load()}
          />
        </>
      )}

      <BudgetDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        budgetedCategories={items.map((i) => i.budget.category)}
        editing={
          editing
            ? {
                category: editing.budget.category,
                monthlyLimit: editing.budget.monthlyLimit,
              }
            : null
        }
        onSaved={() => void load()}
      />
    </DashboardShell>
  );
}
