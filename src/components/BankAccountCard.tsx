import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { CreditCard } from "lucide-react";
import Amount from "@/src/components/Amount";
import { BankAccountI } from "@/src/types";

export const BankAccountCard = ({ bank }: { bank: BankAccountI }) => {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{bank.name}</CardTitle>
        <CreditCard className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          <Amount value={bank.balances.current} />
        </div>
        <p className="text-xs text-muted-foreground">{bank.institution_id}</p>
      </CardContent>
    </Card>
  );
};
