import { PiggyBank, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { BudgetProgress } from "@/lib/stats/budgets";

import { BudgetCard } from "./budget-card";

interface BudgetListProps {
  items: readonly BudgetProgress[];
  onCreate: () => void;
  onEdit: (progress: BudgetProgress) => void;
  onChanged: () => void;
}

/** Grid of budget cards, or an empty state with a create call-to-action. */
export function BudgetList({
  items,
  onCreate,
  onEdit,
  onChanged,
}: BudgetListProps) {
  if (items.length === 0) {
    return (
      <Card className="bg-card/70 items-center gap-4 border-white/10 p-6 text-center backdrop-blur-xl">
        <PiggyBank className="text-muted-foreground h-10 w-10" aria-hidden />
        <h3 className="text-xl font-semibold">No budgets yet</h3>
        <p className="text-muted-foreground max-w-md text-sm">
          Set a monthly limit for a spending category to see how you are
          tracking against it.
        </p>
        <Button onClick={onCreate}>
          <Plus className="h-4 w-4" />
          Create your first budget
        </Button>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {items.map((progress) => (
        <BudgetCard
          key={progress.budget.id}
          progress={progress}
          onEdit={onEdit}
          onDeleted={onChanged}
        />
      ))}
    </div>
  );
}
