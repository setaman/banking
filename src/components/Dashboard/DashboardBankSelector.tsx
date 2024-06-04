"use client";

import { BankAccountI } from "@/src/types";
import { useRouter } from "next/navigation";
import { BankAccountSelector } from "@/src/components/BankAccountSelector";

export function DashboardBankSelector({
  bank,
  banks,
}: {
  bank: BankAccountI;
  banks: BankAccountI[];
}) {
  const router = useRouter();

  const onBankSelect = (bank: BankAccountI) => {
    router.push(`/${bank.account_id}`);
  };
  return (
    <BankAccountSelector bank={bank} banks={banks} onSelect={onBankSelect} />
  );
}
