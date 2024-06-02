import { CreditCard } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { getBanks, getBankTransactions } from "@/app/bank.actions";
import Transactions from "@/src/components/Transactions";
import Amount from "@/src/components/Amount";

export default async function Banks({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) {
  const bankAccountId = searchParams.bankAccountId;

  const transactions = [];

  const banks = await getBanks();
  const firstBank = banks[0];

  if (firstBank) {
    const bankTransactions = await getBankTransactions(firstBank.account_id);
    transactions.push(...bankTransactions);
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        {banks.map((bank) => (
          <div key={bank.account_id}>
            <Card className="bg-primary-foreground shadow-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {bank.name}
                </CardTitle>
                <CardTitle className="text-sm font-medium">
                  Params: {bankAccountId}
                </CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  <Amount value={bank.balances.current} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {bank.institution_id}
                </p>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
      {/*<div className="mt-5">
        <Transactions transactions={transactions} />
      </div>*/}
    </>
  );
}
