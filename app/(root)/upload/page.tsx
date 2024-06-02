"use client";

import { uploadCsvExport } from "@/app/upload.actions";
import { BankAccountI } from "@/src/types";
import { ChevronDown, Bird } from "lucide-react";
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
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuGroup, DropdownMenuItem } from "@/src/components/ui/dropdown-menu";
import { dbBankAccount, dkbBankAccount } from "@/src/lib/institutionsMaps/accounts";

export default function Upload() {
  const [id, setId] = useState("");
  const supportedBanks = [dkbBankAccount, dbBankAccount];
  const [currentBank, setCurrentBank] = useState<BankAccountI | undefined>();
  
  async function uploadFile(formData: FormData) {
    if (currentBank) {
      const resId = await uploadCsvExport(formData, currentBank.account_id);
      setId(resId);
    }
  }

  return (
    <div className="w-full mt-28 flex items-center justify-center">
      {!id && (
        <div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost">
                Select a bank
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuLabel>Select bank Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                {supportedBanks.map((bank) => (
                  <DropdownMenuItem
                    onClick={() => setCurrentBank(bank)}
                    key={bank.account_id}
                  >
                    <div className="flex items-start gap-3 text-muted-foreground">
                      <Bird className="size-5" />
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

          {currentBank && <form action={uploadFile} className="">
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
          </form>}
        </div>
      )}
      {id && (
        <Card className="w-[450px]">
          <CardHeader>
            <CardTitle>Your stats are ready</CardTitle>
            <CardDescription>
              With this link you can access generated stats any time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href={`/upload/${id}`} legacyBehavior passHref>
              <Button style={{ width: "100%" }}>
                <LinkIcon />
                <span className="ml-2">Open link</span>
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
