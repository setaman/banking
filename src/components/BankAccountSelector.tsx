"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import { useState } from "react";
import { BankAccountI } from "@/src/types";
import Link from "next/link";

export function BankAccountSelector({
  bank,
  banks,
  onSelect,
}: {
  bank?: BankAccountI;
  banks: BankAccountI[];
  onSelect?: (bank: BankAccountI) => void;
}) {
  const [currentBank, setCurrentBank] = useState<BankAccountI | undefined>(
    bank
  );

  const selectBank = (b: BankAccountI) => {
    setCurrentBank(b);
    onSelect?.(b);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost">
            {currentBank?.name ?? "Select a bank"}
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuLabel>Select bank Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {banks.map((bank) => (
              <DropdownMenuItem
                onClick={() => selectBank(bank)}
                key={bank.account_id}
              >
                <div className="flex items-start gap-3 text-muted-foreground">
                  <img
                    className="w-8 rounded"
                    src={bank.logo}
                    alt="Bank logo"
                  />
                  <div className="grid gap-0.5">
                    <p>
                      <span className="font-medium text-foreground">
                        {bank.name}
                      </span>
                    </p>
                    <p className="text-xs">{bank.institution_id}</p>
                  </div>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
