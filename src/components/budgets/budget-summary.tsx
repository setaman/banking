import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { BudgetProgress } from "@/lib/stats/budgets";

interface BudgetSummaryProps {
  items: readonly BudgetProgress[];
}

/** Days remaining in the current month, including today. */
function daysLeftInMonth(now: Date = new Date()): number {
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return last - now.getDate() + 1;
}

/**
 * Summary strip: total budgeted, total spent, budgets over / at risk, and
 * days left in the month.
 */
export function BudgetSummary({ items }: BudgetSummaryProps) {
  const budgeted = items.reduce((s, i) => s + i.budget.monthlyLimit, 0);
  const spent = items.reduce((s, i) => s + i.spent, 0);
  const over = items.filter((i) => i.status === "over").length;
  const atRisk = items.filter((i) => i.status === "warning").length;
  const days = daysLeftInMonth();

  const stats = [
    { label: "Total budgeted", value: formatCurrency(budgeted) },
    { label: "Total spent", value: formatCurrency(spent) },
    {
      label: "Over / at risk",
      value: `${over} / ${atRisk}`,
      hint: "over budget / near limit",
    },
    { label: "Days left", value: String(days), hint: "in this month" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => (
        <Card
          key={s.label}
          className="bg-card/70 gap-1 border-white/10 p-6 backdrop-blur-xl"
        >
          <p className="text-muted-foreground text-sm">{s.label}</p>
          <p className="text-2xl font-bold tabular-nums">{s.value}</p>
          {s.hint && <p className="text-muted-foreground text-xs">{s.hint}</p>}
        </Card>
      ))}
    </div>
  );
}
