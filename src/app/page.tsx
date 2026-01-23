import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { OverviewCards } from "@/components/dashboard/overview-cards";
import { TransactionList } from "@/components/dashboard/transaction-list";
import { SpendingChart } from "@/components/dashboard/spending-chart";

export default function Home() {
  return (
    <DashboardShell>
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold tracking-tight text-glow">
          <span className="bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent">
            Welcome back, User
          </span>
        </h1>
        <p className="text-muted-foreground">
          Here's what's happening with your finances today.
        </p>
      </div>

      <OverviewCards />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-4">
          <SpendingChart />
        </div>
        <div className="col-span-3">
          <TransactionList />
        </div>
      </div>
    </DashboardShell>
  );
}
