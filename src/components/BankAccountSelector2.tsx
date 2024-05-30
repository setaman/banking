import { Bird } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { BankAccountI } from "@/src/types";

export default function BankAccountSelector2({
  bank,
  banks,
}: {
  bank: BankAccountI;
  banks: BankAccountI[];
}) {
  return (
    <div className="relative flex">
      <Select>
        <SelectTrigger
          id="model"
          className="items-start [&_[data-description]]:hidden"
        >
          <SelectValue placeholder="Select a bank account" />
        </SelectTrigger>
        <SelectContent>
          {banks.map((bank) => (
            <SelectItem value={bank.account_id} key={bank.account_id}>
              <div className="flex items-start gap-3 text-muted-foreground">
                <Bird className="size-5" />
                <div className="grid gap-0.5">
                  <p>
                    <span className="font-medium text-foreground">
                      {bank.name}
                    </span>
                  </p>

                  <p className="text-xs" data-description>
                    {bank.institution_id}
                  </p>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
