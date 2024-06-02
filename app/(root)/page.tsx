import { getBankById, getBanks, getBanksCount } from "@/app/bank.actions";
import { BankAccountI } from "@/src/types";
import { redirect } from "next/navigation";
import { DashboardModeSelector } from "@/src/components/DashboardModeSelector";
import { BankAccountSelector } from "@/src/components/BankAccountSelector";
import Dashboard from "@/src/components/Dashboard/Dashboard";

export default async function Home({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) {
  const banksCount = await getBanksCount();
  const banks = await getBanks();

  if (banksCount === 0) {
    redirect("/banks");
  }

  const bankAccountId = searchParams.bankAccountId;

  let bank: BankAccountI | undefined = undefined;

  if (bankAccountId) {
    bank = await getBankById(bankAccountId);
  } else {
    bank = banks[0] as BankAccountI;
  }

  return (
    <main>
      <Dashboard
        stats={{
          expenses: 0,
          income: 0,
          totalBalance: 0,
          transactionsGroupByDay: [],
          transactionsGroupByMonth: [],
        }}
      >
        <h2 className="scroll-m-20 text-2xl font-semibold tracking-tight">
          Showing
        </h2>
        {bank && <BankAccountSelector bank={bank} banks={banks} />}
        <h2 className="scroll-m-20 text-2xl font-semibold tracking-tight">
          data for
        </h2>
        <DashboardModeSelector />
      </Dashboard>
    </main>
  );
}
