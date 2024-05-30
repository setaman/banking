import { z } from "zod";
import { parse } from "date-fns";
import { BankAccountI, TransactionI } from "@/src/types";
import { Banks, Transactions } from "@/db/db";
import { EURO } from "@/src/lib/utils";
import { hash256 } from "@/src/lib/hash256";
import { parseCsv } from "@/src/lib/parseCsv";
import fs from "node:fs";

const dkbInstitution = {
  name: "Deutsche Kreditbank - DKB",
  institution_id: "ins_128043",
};

const akbBankAccount: BankAccountI = {
  name: "DKB CSV import",
  account_id: "vgczt6sjaCc6xrKUe4uxc",
  institution_id: "ins_128043",
  balances: {
    current: 7444.44,
  },
};

const dkbTransaction = z
  .object({
    Buchungsdatum: z.string().min(8),
    Wertstellung: z.string().optional(),
    "Betrag (€)": z.string(),
    Status: z.enum(["Gebucht", "Vorgemerkt"]),
    "Zahlungsempfänger*in": z.string(),
    "Zahlungspflichtige*r": z.string(),
    Verwendungszweck: z.string().optional(),
  })
  .transform((t): TransactionI => {
    const [day, month, year] = t.Buchungsdatum.split(".");
    const parsedAuthDate = parse(
      `${day}.${month}.20${year}`,
      "dd.MM.yyyy",
      new Date()
    );
    const parsedDate = t.Wertstellung
      ? parse(t.Wertstellung, "dd.MM.yyyy", new Date())
      : null;
    const amount = EURO(t["Betrag (€)"]);
    // generate a (hopefully) unique transaction id based on the transaction data hash
    const transaction_id = hash256([
      parsedDate ? parsedDate.toISOString() : "",
      parsedAuthDate.toISOString(),
      amount.format(),
      t["Zahlungsempfänger*in"],
      t["Zahlungspflichtige*r"],
      t.Verwendungszweck ?? "",
    ]);
    return {
      account_id: "",
      transaction_id,
      amount: amount.value * -1,
      authorized_date: parsedAuthDate.toISOString(),
      date: parsedDate ? parsedDate.toISOString() : "",
      pending: t.Status !== "Gebucht",
      merchant_name: t["Zahlungsempfänger*in"],
      name: t.Verwendungszweck ?? "",
      iso_currency_code: "EUR",
    };
  });

export const mapDkbCsvExportToTransactions = (file: string): TransactionI[] => {
  let transactions = parseCsv(file).filter((t) => {
    const parseResult = dkbTransaction.safeParse(t);
    if (!parseResult.success) {
      console.warn("Invalid transaction entry! Skipped!", t, parseResult.error);
    }
    return parseResult.success;
  });
  return z
    .array(dkbTransaction)
    .parse(transactions)
    .map((t) => ({
      ...t,
      account_id: akbBankAccount.account_id,
    }));
};

export const init = () => {
  if (!Banks.getById(akbBankAccount.account_id)) {
    Banks.insert(akbBankAccount);
  }
  /* const file = fs.readFileSync(
    "./src/lib/institutionsMaps/dkb/20-05-2024.csv",
    "utf-8"
  );
  let transactions = mapDkbCsvExportToTransactions(file).filter(
    (t) => !Transactions.getById(t.transaction_id)
  );
  if (transactions.length > 0) {
    console.log(
      `--- Inserting ${transactions.length} new transactions for ${dkbInstitution.name} ---`
    );
    Transactions.insertBulk(transactions as TransactionI[]);
  }*/
};
