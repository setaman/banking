import { z } from "zod";
import { parse } from "date-fns";
import { TransactionI } from "@/src/types";
import { EURO } from "@/src/lib/utils";
import { hash256 } from "@/src/lib/hash256";

export const dkbTransaction = z
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