import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { DollarSign, ArrowDownLeft, Minus, ArrowUpRight } from "lucide-react";
import { StatCard } from "@/src/components/StatCard";
import Amount from "@/src/components/Amount";
import { StatsI } from "@/src/types";
import { IncomeExpenseDistribution } from "@/src/components/Dashboard/Charts/IncomeExpenseDistribution";

export default async function Dashboard({
  stats,
  children,
}: {
  stats: StatsI;
  children?: React.ReactNode;
}) {
  return (
    <main>
      <div className="mb-5 flex items-center">
        {children ? (
          children
        ) : (
          <h2 className="scroll-m-20 text-2xl font-semibold tracking-tight">
            Showing uploaded data statistics
          </h2>
        )}
      </div>
      <div className="grid grid-cols-4 gap-5">
        <div className="col-span-4 md:col-span-4 lg:col-span-2 xl:col-span-1">
          <Card className="bg-primary-foreground">
            <CardContent>
              <div className="mt-5">
                <StatCard
                  title="Total"
                  icon={
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  }
                >
                  <Amount value={stats.totalBalance} />
                </StatCard>
              </div>
              <div className="grid grid-cols-2 gap-5 mt-5">
                <div className="col-span-1">
                  <StatCard
                    title="Expenses"
                    icon={
                      <ArrowDownLeft
                        className="h-4 w-4 text-muted-foreground"
                        color="red"
                      />
                    }
                  >
                    <span className="text-sm">
                      <Amount value={stats.expenses} colored={false} />
                    </span>
                  </StatCard>
                </div>
                <div className="col-span-1">
                  <StatCard
                    title="Income"
                    icon={
                      <ArrowUpRight
                        className="h-4 w-4 text-muted-foreground"
                        color="green"
                      />
                    }
                  >
                    <span className="text-sm">
                      <Amount value={stats.income} colored={false} />
                    </span>
                  </StatCard>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="col-span-4 md:col-span-4 lg:col-span-2 xl:col-span-3">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Nice Chart</CardTitle>
            </CardHeader>
            <CardContent className="grow">
              <IncomeExpenseDistribution stats={stats} />
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
