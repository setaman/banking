import Dashboard from "@/src/components/Dashboard/Dashboard";
import Transactions from "@/src/components/Transactions";
import { getBankAccountStats, getBankById, getBanks } from "@/app/bank.actions";
import { DashboardModeSelector } from "@/src/components/DashboardModeSelector";
import { DashboardBankSelector } from "@/src/components/Dashboard/DashboardBankSelector";

export default async function UploadResult({
  params,
}: {
  params: { id: string };
}) {
  const bank = await getBankById(params.id);
  const stats = await getBankAccountStats(params.id);
  const banks = await getBanks();

  return (
    <>
      {stats && (
        <>
          <Dashboard stats={stats}>
            <h2 className="scroll-m-20 text-2xl font-semibold tracking-tight">
              Showing
            </h2>
            {bank && <DashboardBankSelector bank={bank} banks={banks} />}
            <h2 className="scroll-m-20 text-2xl font-semibold tracking-tight">
              data for
            </h2>
            <DashboardModeSelector />
          </Dashboard>
          <div className="mt-16">
            <Transactions
              transactions={stats?.transactionsGroupByMonth ?? []}
            />
          </div>
        </>
      )}
    </>
  );
}
