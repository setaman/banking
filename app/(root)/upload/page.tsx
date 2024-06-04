"use client";

import { uploadCsvExport } from "@/app/upload.actions";
import { BankAccountI, CsvTransactionImportResult } from "@/src/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";

import { Button } from "@/src/components/ui/button";
import { useState } from "react";
import Link from "next/link";
import { Link as LinkIcon } from "lucide-react";
import {
  dbBankAccount,
  dkbBankAccount,
} from "@/src/lib/institutionsMaps/accounts";
import { BankAccountSelector } from "@/src/components/BankAccountSelector";

export default function Upload() {
  const [stats, setStats] = useState<CsvTransactionImportResult | null>();
  const supportedBanks = [dkbBankAccount, dbBankAccount];
  const [currentBank, setCurrentBank] = useState<BankAccountI | undefined>();

  async function uploadFile(formData: FormData) {
    if (currentBank) {
      const importStats = await uploadCsvExport(
        formData,
        currentBank.account_id
      );
      setStats(importStats);
    }
  }

  return (
    <div className="w-full mt-28 flex items-center justify-center">
      {!stats && (
        <div>
          <BankAccountSelector
            banks={supportedBanks}
            onSelect={setCurrentBank}
          />
          {currentBank && (
            <form action={uploadFile} className="">
              <Card className="w-[450px]">
                <CardHeader>
                  <CardTitle>Upload CSV file</CardTitle>
                  <CardDescription>
                    Set a user name to personalize the app
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <input
                    name="file"
                    className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 dark:text-gray-400 focus:outline-none dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400"
                    id="default_size"
                    type="file"
                  />
                </CardContent>
                <CardFooter className="flex justify-end">
                  <Button type="submit">Submit</Button>
                </CardFooter>
              </Card>
            </form>
          )}
        </div>
      )}
      {stats && (
        <Card className="w-[450px]">
          <CardHeader>
            <CardTitle>Transactions importiert</CardTitle>
            <CardDescription>
              <div className="flex flex-col items-center">
                <img
                  style={{ width: "70px" }}
                  src={currentBank?.logo}
                  className="col-span-1 mt-4"
                />
                <p className="col-span-1 mt-4">
                  We have found
                  <span className="font-bold mx-1">
                    {stats.newTransactionsCount}
                  </span>
                  new transactions
                </p>
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href={`/${currentBank?.account_id}`} legacyBehavior passHref>
              <Button style={{ width: "100%" }}>
                <LinkIcon />
                <span className="ml-2">Go to dashboard</span>
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
