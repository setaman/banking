"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { FlaskConical, Plus, Shield, Pencil, Save, Trash2, ChevronDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { getTransactions } from "@/actions/transactions.actions";
import { getTotalBalance } from "@/actions/accounts.actions";

import {
  calculateMonthlyFlow,
  calculateEmergencyFund,
} from "@/lib/stats/calculations";
import { detectRecurring } from "@/lib/stats/categories";
import {
  calculateSandboxPrediction,
  type SandboxPoint,
} from "@/lib/stats/sandbox-projector";
import { useScenarios } from "@/hooks/use-scenarios";

import { ComparisonChart } from "@/components/sandbox/comparison-chart";
import { RuleCard } from "@/components/sandbox/rule-card";

import type { UnifiedTransaction } from "@/lib/banking/types";
import type { RecurringTransactionGroup } from "@/lib/stats/categories";
import type { ScenarioRule } from "@/lib/stats/sandbox-projector";

const MotionCard = motion.create(Card);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

function deltaClass(value: number): string {
  if (value > 0) return "text-emerald-400";
  if (value < 0) return "text-rose-400";
  return "text-muted-foreground";
}

function deltaPrefix(value: number): string {
  return value > 0 ? "+" : "";
}

// ---------------------------------------------------------------------------
// Delta widget — scenario vs baseline at Yr 1 / 5 / 10
// ---------------------------------------------------------------------------

interface DeltaWidgetProps {
  readonly points: SandboxPoint[];
}

function DeltaWidget({ points }: DeltaWidgetProps): React.JSX.Element {
  const milestones = [
    { label: "Year 1", month: 12 },
    { label: "Year 5", month: 60 },
    { label: "Year 10", month: 120 },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {milestones.map(({ label, month }) => {
        const pt = points.find((p) => p.month === month);
        const delta = pt ? pt.scenario - pt.baseline : null;

        return (
          <div
            key={label}
            className="bg-card flex flex-col items-center gap-1 rounded-xl border border-border p-3 text-center dark:bg-card/80"
          >
            <p className="text-muted-foreground text-xs font-medium">{label}</p>
            {delta !== null ? (
              <>
                <p
                  className={cn(
                    "text-base font-bold tabular-nums",
                    deltaClass(delta)
                  )}
                >
                  {deltaPrefix(delta)}
                  {formatCurrency(delta)}
                </p>
                <p className="text-muted-foreground/60 text-xs">vs baseline</p>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">—</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Safety-Net badge
// ---------------------------------------------------------------------------

interface SafetyNetBadgeProps {
  readonly transactions: UnifiedTransaction[];
  readonly baselineBalance: number;
  readonly scenarioBalance: number;
}

function SafetyNetBadge({
  transactions,
  baselineBalance,
  scenarioBalance,
}: SafetyNetBadgeProps): React.JSX.Element {
  const baselineFund = calculateEmergencyFund(baselineBalance, transactions);
  const scenarioFund = calculateEmergencyFund(scenarioBalance, transactions);

  const diff = scenarioFund.months - baselineFund.months;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-emerald-500/5 p-3 dark:border-emerald-500/20">
      <Shield className="h-5 w-5 shrink-0 text-emerald-400" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="text-foreground font-semibold">Safety Net</p>
        <p className="text-muted-foreground text-xs">
          Emergency fund moves from{" "}
          <span className="font-medium">
            {baselineFund.months.toFixed(1)} mo
          </span>{" "}
          to{" "}
          <span
            className={cn("font-medium", deltaClass(diff))}
          >
            {scenarioFund.months.toFixed(1)} mo
          </span>
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scenario selector + actions panel (left column)
// ---------------------------------------------------------------------------

interface ScenarioPanelProps {
  scenarios: ReturnType<typeof useScenarios>["scenarios"];
  activeScenarioId: string;
  setActiveScenarioId: (id: string) => void;
  saveAsNew: (name: string) => void;
  renameScenario: (id: string, name: string) => void;
  deleteScenario: (id: string) => void;
  addRule: (rule: Omit<ScenarioRule, "id">) => void;
  updateRule: (id: string, patch: Partial<Omit<ScenarioRule, "id">>) => void;
  removeRule: (id: string) => void;
  rules: ScenarioRule[];
  recurringGroups: RecurringTransactionGroup[];
}

function ScenarioPanel({
  scenarios,
  activeScenarioId,
  setActiveScenarioId,
  saveAsNew,
  renameScenario,
  deleteScenario,
  addRule,
  updateRule,
  removeRule,
  rules,
  recurringGroups,
}: ScenarioPanelProps): React.JSX.Element {
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [savingNew, setSavingNew] = useState(false);
  const [newName, setNewName] = useState("");

  const activeScenario = scenarios[activeScenarioId];
  const scenarioList = Object.values(scenarios);
  const isDefault = activeScenarioId === "default";

  const handleRenameStart = (): void => {
    setRenameValue(activeScenario?.name ?? "");
    setRenaming(true);
  };

  const handleRenameConfirm = (): void => {
    if (renameValue.trim()) {
      renameScenario(activeScenarioId, renameValue.trim());
    }
    setRenaming(false);
  };

  const handleSaveNew = (): void => {
    if (newName.trim()) {
      saveAsNew(newName.trim());
      setNewName("");
      setSavingNew(false);
    }
  };

  const handleDelete = (): void => {
    deleteScenario(activeScenarioId);
  };

  // Default rule templates
  const handleAddRecurring = (): void => {
    addRule({
      type: "recurring",
      name: "New monthly income",
      enabled: true,
      amount: 200,
      startMonthOffset: 0,
    });
  };

  const handleAddOnetime = (): void => {
    addRule({
      type: "onetime",
      name: "One-time expense",
      enabled: true,
      amount: -5000,
      startMonthOffset: 0,
      targetYear: 2,
    });
  };

  const handleAddSubscription = (): void => {
    const firstGroup = recurringGroups[0];
    addRule({
      type: "subscription",
      name: firstGroup
        ? `Cancel: ${firstGroup.counterparty}`
        : "Cancel subscription",
      enabled: true,
      amount: firstGroup ? Math.abs(firstGroup.averageAmount) : 15,
      startMonthOffset: 0,
      subscriptionName: firstGroup?.counterparty ?? "",
    });
  };

  const handleAddInvestment = (): void => {
    addRule({
      type: "investment",
      name: "ETF investment",
      enabled: true,
      amount: 300,
      startMonthOffset: 0,
      annualRate: 0.07,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Scenario selector */}
      <div className="bg-card rounded-xl border border-border p-4 backdrop-blur-xl dark:bg-card/80">
        <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
          Active Scenario
        </p>

        {/* Scenario dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="border-border bg-background w-full justify-between"
            >
              <span className="truncate">
                {activeScenario?.name ?? "Default"}
              </span>
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            {scenarioList.map((s) => (
              <DropdownMenuItem
                key={s.id}
                onClick={() => setActiveScenarioId(s.id)}
                className={cn(
                  s.id === activeScenarioId && "bg-accent"
                )}
              >
                {s.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Rename inline */}
        {renaming ? (
          <div className="mt-3 flex gap-2">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="border-border bg-background h-8 flex-1 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameConfirm();
                if (e.key === "Escape") setRenaming(false);
              }}
              autoFocus
            />
            <Button size="sm" onClick={handleRenameConfirm}>
              Save
            </Button>
          </div>
        ) : null}

        {/* Save as new inline */}
        {savingNew ? (
          <div className="mt-3 flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Scenario name…"
              className="border-border bg-background h-8 flex-1 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveNew();
                if (e.key === "Escape") setSavingNew(false);
              }}
              autoFocus
            />
            <Button size="sm" onClick={handleSaveNew}>
              Save
            </Button>
          </div>
        ) : null}

        {/* Action buttons */}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-border gap-1.5"
            onClick={handleRenameStart}
          >
            <Pencil className="h-3 w-3" />
            Rename
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-border gap-1.5"
            onClick={() => setSavingNew(true)}
          >
            <Save className="h-3 w-3" />
            Save As New
          </Button>
          {!isDefault && (
            <Button
              variant="outline"
              size="sm"
              className="border-destructive/40 text-destructive hover:bg-destructive/10 gap-1.5"
              onClick={handleDelete}
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Add rule buttons */}
      <div className="bg-card rounded-xl border border-border p-4 backdrop-blur-xl dark:bg-card/80">
        <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wide">
          Add Rule
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-blue-500/30 bg-blue-500/5 text-blue-400 hover:bg-blue-500/15 gap-1.5"
            onClick={handleAddRecurring}
          >
            <Plus className="h-3.5 w-3.5" />
            Recurring
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-amber-500/30 bg-amber-500/5 text-amber-400 hover:bg-amber-500/15 gap-1.5"
            onClick={handleAddOnetime}
          >
            <Plus className="h-3.5 w-3.5" />
            One-Time
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-emerald-500/30 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/15 gap-1.5"
            onClick={handleAddSubscription}
          >
            <Plus className="h-3.5 w-3.5" />
            Cut Sub
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-violet-500/30 bg-violet-500/5 text-violet-400 hover:bg-violet-500/15 gap-1.5"
            onClick={handleAddInvestment}
          >
            <Plus className="h-3.5 w-3.5" />
            ETF Yield
          </Button>
        </div>
      </div>

      {/* Rules list */}
      {rules.length > 0 ? (
        <div className="flex max-h-[520px] flex-col gap-3 overflow-y-auto pr-1">
          {rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              recurringGroups={recurringGroups}
              onUpdate={updateRule}
              onRemove={removeRule}
            />
          ))}
        </div>
      ) : (
        <div className="bg-muted/30 flex flex-col items-center justify-center gap-2 rounded-xl border border-border py-10 text-center dark:bg-card/20">
          <FlaskConical className="text-muted-foreground/40 h-8 w-8" />
          <p className="text-muted-foreground text-sm">No rules yet</p>
          <p className="text-muted-foreground/60 text-xs">
            Add a rule above to start simulating
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SandboxPage(): React.JSX.Element {
  const [transactions, setTransactions] = useState<UnifiedTransaction[]>([]);
  const [totalBalance, setTotalBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    scenarios,
    activeScenarioId,
    setActiveScenarioId,
    addRule,
    updateRule,
    removeRule,
    saveAsNew,
    renameScenario,
    deleteScenario,
  } = useScenarios();

  // Load data on mount
  useEffect(() => {
    async function loadData(): Promise<void> {
      try {
        setLoading(true);
        const [txData, balanceData] = await Promise.all([
          getTransactions(undefined, { excludeInternal: true }),
          getTotalBalance(),
        ]);
        setTransactions(txData);
        setTotalBalance(balanceData);
      } catch (err) {
        console.error("Failed to load sandbox data:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load data"
        );
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Derived data
  const monthlyCashFlow = useMemo(
    () => calculateMonthlyFlow(transactions),
    [transactions]
  );

  // Dedupe recurring groups by counterparty — detectRecurring() can emit
  // multiple clusters for the same merchant (different amount tiers). Merge
  // them into one entry whose averageAmount is the SUM of all clusters so
  // that cancelling a merchant reflects its full recurring monthly cost.
  // The merged counterparty name comes from the first (highest-frequency)
  // cluster, preserving original casing.
  const recurringGroups = useMemo((): RecurringTransactionGroup[] => {
    const raw = detectRecurring(transactions);
    const merged = new Map<string, RecurringTransactionGroup>();
    for (const group of raw) {
      const key = group.counterparty.trim().toLowerCase();
      const existing = merged.get(key);
      if (existing) {
        // Merge: sum averageAmount, concatenate transactions list.
        merged.set(key, {
          ...existing,
          averageAmount: existing.averageAmount + group.averageAmount,
          transactions: [...existing.transactions, ...group.transactions],
        });
      } else {
        merged.set(key, group);
      }
    }
    return Array.from(merged.values());
  }, [transactions]);

  // Active scenario rules
  const rules = useMemo(
    () => scenarios[activeScenarioId]?.rules ?? [],
    [scenarios, activeScenarioId]
  );

  // Sandbox prediction (memoized)
  const sandboxResult = useMemo(
    () =>
      calculateSandboxPrediction(totalBalance, monthlyCashFlow, rules),
    [totalBalance, monthlyCashFlow, rules]
  );

  // End-state balances for Safety-Net badge
  const finalPoints =
    sandboxResult.status === "ok"
      ? sandboxResult.points[sandboxResult.points.length - 1]
      : null;

  // Loading skeleton
  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 w-72" />
          <Skeleton className="h-5 w-96" />
        </div>
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
          <div className="space-y-4 lg:col-span-8">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-80 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Card className="border-rose-500/20">
          <CardContent className="flex items-center justify-center p-12">
            <div className="text-center">
              <p className="text-lg font-semibold text-rose-400">
                Failed to load sandbox data
              </p>
              <p className="text-muted-foreground mt-2 text-sm">{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* Page header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h1
            className="text-4xl font-bold tracking-tight"
            style={{
              background:
                "linear-gradient(135deg, rgba(139,92,246,1) 0%, rgba(167,139,250,1) 50%, rgba(196,181,253,0.7) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              filter: "drop-shadow(0 0 24px rgba(139,92,246,0.35))",
            }}
          >
            Scenario Playground
          </h1>
          <Badge className="border-violet-500/30 bg-violet-500/15 px-2.5 py-1 text-xs font-semibold text-violet-400">
            Simulation Mode
          </Badge>
        </div>
        <p className="text-muted-foreground">
          Model financial what-ifs and see how they affect your balance over
          time. Nothing here changes your real data.
        </p>
      </div>

      {/* Insufficient data state */}
      {sandboxResult.status === "insufficient-data" ? (
        <MotionCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden border-violet-500/20"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-indigo-500/5 opacity-50" />
          <CardContent className="relative z-10 flex items-center justify-between gap-6 p-8">
            <div>
              <p className="text-3xl font-bold text-violet-400/60">—</p>
              <p className="text-foreground mt-2 font-semibold">
                Not enough history yet to simulate
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                We need at least 3 months of data to run a projection. Keep
                tracking and check back soon.
              </p>
            </div>
            <FlaskConical className="h-12 w-12 shrink-0 text-violet-400/30" />
          </CardContent>
        </MotionCard>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* ── LEFT: Scenario manager ── */}
          <MotionCard
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 }}
            className="border-primary/10 relative overflow-hidden lg:col-span-4"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-indigo-500/5 opacity-40" />
            <CardHeader className="relative z-10 pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FlaskConical className="h-4 w-4 text-violet-400" />
                Scenarios
              </CardTitle>
            </CardHeader>
            <CardContent className="relative z-10">
              <ScenarioPanel
                scenarios={scenarios}
                activeScenarioId={activeScenarioId}
                setActiveScenarioId={setActiveScenarioId}
                saveAsNew={saveAsNew}
                renameScenario={renameScenario}
                deleteScenario={deleteScenario}
                addRule={addRule}
                updateRule={updateRule}
                removeRule={removeRule}
                rules={rules}
                recurringGroups={recurringGroups}
              />
            </CardContent>
          </MotionCard>

          {/* ── RIGHT: Visualization ── */}
          <div className="flex flex-col gap-4 lg:col-span-8">
            {/* Comparative Delta widget */}
            <MotionCard
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="border-primary/10 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-indigo-500/5 opacity-40" />
              <CardHeader className="relative z-10 pb-2">
                <CardTitle className="text-sm font-semibold text-violet-300">
                  Scenario vs Baseline
                </CardTitle>
              </CardHeader>
              <CardContent className="relative z-10">
                {sandboxResult.status === "ok" && (
                  <DeltaWidget points={sandboxResult.points} />
                )}
              </CardContent>
            </MotionCard>

            {/* Comparison chart */}
            <MotionCard
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="border-primary/10 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-indigo-500/5 opacity-40" />
              <CardHeader className="relative z-10 pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  10-Year Projection
                </CardTitle>
                <p className="text-muted-foreground/70 text-xs">
                  Dotted grey = baseline &nbsp;·&nbsp; Solid violet = scenario
                </p>
              </CardHeader>
              <CardContent className="relative z-10">
                {sandboxResult.status === "ok" && (
                  <ComparisonChart points={sandboxResult.points} />
                )}
              </CardContent>
            </MotionCard>

            {/* Safety-Net badge */}
            {finalPoints && (
              <MotionCard
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="border-primary/10 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-teal-500/5 opacity-40" />
                <CardContent className="relative z-10 p-4">
                  <SafetyNetBadge
                    transactions={transactions}
                    baselineBalance={finalPoints.baseline}
                    scenarioBalance={finalPoints.scenario}
                  />
                </CardContent>
              </MotionCard>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
