import { CreditCard } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { getBanks } from "@/app/bank.actions";
import Amount from "@/src/components/Amount";
import Link from "next/link";

export default async function Banks() {
  const banks = await getBanks();

  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        {banks.map((bank) => (
          <Link
            href={`/${bank.account_id}`}
            legacyBehavior
            passHref
            key={bank.account_id}
          >
            <Card className="bg-primary-foreground shadow-card hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700 cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {bank.name}
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
          </Link>
        ))}
      </div>
    </>
  );
}
