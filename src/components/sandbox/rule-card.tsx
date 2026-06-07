"use client";

import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { ScenarioRule } from "@/lib/stats/sandbox-projector";
import type { RecurringTransactionGroup } from "@/lib/stats/categories";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RuleCardProps {
  readonly rule: ScenarioRule;
  /** Detected recurring groups used to populate the subscription selector. */
  readonly recurringGroups: RecurringTransactionGroup[];
  onUpdate: (id: string, patch: Partial<Omit<ScenarioRule, "id">>) => void;
  onRemove: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Type badge colors
// ---------------------------------------------------------------------------

const TYPE_STYLES: Record<ScenarioRule["type"], string> = {
  recurring:
    "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  onetime:
    "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  subscription:
    "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  investment:
    "bg-violet-500/15 text-violet-400 border border-violet-500/30",
};

const TYPE_LABELS: Record<ScenarioRule["type"], string> = {
  recurring: "Recurring",
  onetime: "One-Time",
  subscription: "Subscription Cut",
  investment: "ETF / Investment",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RuleCard({
  rule,
  recurringGroups,
  onUpdate,
  onRemove,
}: RuleCardProps): React.JSX.Element {
  const handleToggleEnabled = (checked: boolean): void => {
    onUpdate(rule.id, { enabled: checked });
  };

  const handleRemove = (): void => {
    onRemove(rule.id);
  };

  return (
    <div
      className={cn(
        "bg-card/40 relative rounded-xl border border-white/10 p-4 backdrop-blur-xl transition-all duration-200",
        !rule.enabled && "opacity-50"
      )}
    >
      {/* Header row */}
      <div className="mb-3 flex items-center gap-3">
        <Switch
          checked={rule.enabled}
          onCheckedChange={handleToggleEnabled}
          aria-label={`Toggle ${rule.name}`}
        />
        <div className="min-w-0 flex-1">
          <p className="text-foreground truncate text-sm font-semibold">
            {rule.name}
          </p>
          <span
            className={cn(
              "mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-medium",
              TYPE_STYLES[rule.type]
            )}
          >
            {TYPE_LABELS[rule.type]}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive h-7 w-7 shrink-0"
          onClick={handleRemove}
          aria-label={`Delete rule ${rule.name}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Type-specific controls */}
      {rule.type === "recurring" && (
        <RecurringControls rule={rule} onUpdate={onUpdate} />
      )}
      {rule.type === "onetime" && (
        <OneTimeControls rule={rule} onUpdate={onUpdate} />
      )}
      {rule.type === "subscription" && (
        <SubscriptionControls
          rule={rule}
          recurringGroups={recurringGroups}
          onUpdate={onUpdate}
        />
      )}
      {rule.type === "investment" && (
        <InvestmentControls rule={rule} onUpdate={onUpdate} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recurring controls
// ---------------------------------------------------------------------------

interface ControlsProps {
  rule: ScenarioRule;
  onUpdate: (id: string, patch: Partial<Omit<ScenarioRule, "id">>) => void;
}

function RecurringControls({ rule, onUpdate }: ControlsProps): React.JSX.Element {
  const amount = rule.amount;
  const startMonth = rule.startMonthOffset;

  return (
    <div className="space-y-4">
      {/* Amount slider: -2000 to +2000, step 50 */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-muted-foreground text-xs">
            Monthly delta
          </Label>
          <span
            className={cn(
              "text-xs font-semibold tabular-nums",
              amount >= 0 ? "text-emerald-400" : "text-rose-400"
            )}
          >
            {amount >= 0 ? "+" : ""}
            {formatCurrency(amount)} / mo
          </span>
        </div>
        <Slider
          min={-2000}
          max={2000}
          step={50}
          value={[amount]}
          onValueChange={([v]) => onUpdate(rule.id, { amount: v })}
          className="w-full"
        />
        <div className="text-muted-foreground/60 flex justify-between text-xs">
          <span>-€2 000</span>
          <span>+€2 000</span>
        </div>
      </div>

      {/* Start month offset */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-muted-foreground text-xs">
            Starts after
          </Label>
          <span className="text-xs font-semibold tabular-nums">
            {startMonth === 0 ? "now" : `month ${startMonth}`}
          </span>
        </div>
        <Slider
          min={0}
          max={12}
          step={1}
          value={[startMonth]}
          onValueChange={([v]) =>
            onUpdate(rule.id, { startMonthOffset: v })
          }
          className="w-full"
        />
        <div className="text-muted-foreground/60 flex justify-between text-xs">
          <span>Now</span>
          <span>Month 12</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// One-time controls
// ---------------------------------------------------------------------------

function OneTimeControls({ rule, onUpdate }: ControlsProps): React.JSX.Element {
  const targetYear = rule.targetYear ?? 1;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const parsed = parseFloat(e.target.value);
    if (!isNaN(parsed)) {
      onUpdate(rule.id, { amount: parsed });
    }
  };

  return (
    <div className="space-y-4">
      {/* Amount input */}
      <div className="space-y-1.5">
        <Label className="text-muted-foreground text-xs">Amount (€)</Label>
        <Input
          type="number"
          value={rule.amount}
          onChange={handleAmountChange}
          placeholder="e.g. 5000"
          className="bg-card/50 border-white/10 h-8 text-sm"
          step={100}
        />
        <p className="text-muted-foreground/60 text-xs">
          Positive = inflow (e.g. bonus), negative = outflow (e.g. car purchase)
        </p>
      </div>

      {/* Target year slider */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-muted-foreground text-xs">
            Applies in
          </Label>
          <span className="text-xs font-semibold tabular-nums">
            Year {targetYear}
          </span>
        </div>
        <Slider
          min={1}
          max={10}
          step={1}
          value={[targetYear]}
          onValueChange={([v]) => onUpdate(rule.id, { targetYear: v })}
          className="w-full"
        />
        <div className="text-muted-foreground/60 flex justify-between text-xs">
          <span>Yr 1</span>
          <span>Yr 10</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subscription controls
// ---------------------------------------------------------------------------

interface SubscriptionControlsProps extends ControlsProps {
  recurringGroups: RecurringTransactionGroup[];
}

function SubscriptionControls({
  rule,
  recurringGroups,
  onUpdate,
}: SubscriptionControlsProps): React.JSX.Element {
  const selectedName = rule.subscriptionName ?? "";

  const handleSelect = (name: string): void => {
    const group = recurringGroups.find((g) => g.counterparty === name);
    if (group) {
      onUpdate(rule.id, {
        subscriptionName: name,
        amount: Math.abs(group.averageAmount),
        name: `Cancel: ${group.counterparty}`,
      });
    }
  };

  const monthlyCost = rule.amount > 0 ? rule.amount : Math.abs(rule.amount);

  return (
    <div className="space-y-4">
      {recurringGroups.length === 0 ? (
        <p className="text-muted-foreground/70 text-xs">
          No recurring merchant patterns detected. Sync more transactions to
          populate this list.
        </p>
      ) : (
        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs">
            Merchant to cancel
          </Label>
          <Select
            value={selectedName}
            onValueChange={handleSelect}
          >
            <SelectTrigger className="bg-card/50 border-white/10 h-8 text-sm">
              <SelectValue placeholder="Select merchant…" />
            </SelectTrigger>
            <SelectContent>
              {recurringGroups.map((g) => (
                <SelectItem key={g.counterparty} value={g.counterparty}>
                  <span className="flex items-center justify-between gap-4">
                    <span className="truncate">{g.counterparty}</span>
                    <span className="text-muted-foreground text-xs">
                      {formatCurrency(Math.abs(g.averageAmount))}/mo
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {monthlyCost > 0 && (
        <p className="text-emerald-400 text-xs">
          Cancelling saves{" "}
          <span className="font-semibold">{formatCurrency(monthlyCost)}</span>{" "}
          / month
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Investment controls
// ---------------------------------------------------------------------------

function InvestmentControls({ rule, onUpdate }: ControlsProps): React.JSX.Element {
  const annualRate = (rule.annualRate ?? 0) * 100; // stored as 0..0.12, display as %

  return (
    <div className="space-y-4">
      {/* Monthly contribution */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-muted-foreground text-xs">
            Monthly contribution
          </Label>
          <span className="text-emerald-400 text-xs font-semibold tabular-nums">
            {rule.amount >= 0 ? "+" : ""}
            {formatCurrency(rule.amount)} / mo
          </span>
        </div>
        <Slider
          min={0}
          max={2000}
          step={50}
          value={[rule.amount]}
          onValueChange={([v]) => onUpdate(rule.id, { amount: v })}
          className="w-full"
        />
        <div className="text-muted-foreground/60 flex justify-between text-xs">
          <span>€0</span>
          <span>€2 000</span>
        </div>
      </div>

      {/* Annual yield slider */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-muted-foreground text-xs">
            Annual yield
          </Label>
          <span className="text-violet-400 text-xs font-semibold tabular-nums">
            {annualRate.toFixed(1)}%
          </span>
        </div>
        <Slider
          min={0}
          max={12}
          step={0.5}
          value={[annualRate]}
          onValueChange={([v]) =>
            onUpdate(rule.id, { annualRate: v / 100 })
          }
          className="w-full"
        />
        <div className="text-muted-foreground/60 flex justify-between text-xs">
          <span>0%</span>
          <span>12%</span>
        </div>
      </div>
    </div>
  );
}
