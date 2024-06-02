import { z } from "zod";
import { parse } from "date-fns";
import { TransactionI } from "@/src/types";
import { EURO } from "@/src/lib/utils";
import { hash256 } from "@/src/lib/hash256";

export const dbTransaction = z
  .object({
    Buchungstag: z.string(),
    Wert: z.string().optional(),
    Soll: z.string(),
    Haben: z.string(),
    Auftraggeber: z.string().optional(),
    Verwendungszweck: z.string().optional(),
  })
  .transform((t): TransactionI => {
    const [day, month, year] = t.Buchungstag.split(".");
    
    const parsedAuthDate = parse(
      `${day}.${month}.${year}`,
      "dd.MM.yyyy",
      new Date()
    );

    const parsedDate = t.Wert
      ? parse(t.Wert, "dd.MM.yyyy", new Date())
      : null;
    const amount = EURO(t.Soll).value != 0 ? EURO(t.Soll) : EURO(t.Haben);

    // generate a (hopefully) unique transaction id based on the transaction data hash
    const transaction_id = hash256([
      parsedDate ? parsedDate.toISOString() : "",
      parsedAuthDate.toISOString(),
      amount.format(),
      t.Auftraggeber ?? "",
      t.Verwendungszweck ?? "",
    ]);

    return {
      account_id: "",
      transaction_id: transaction_id,
      amount: amount.value * -1,
      authorized_date: parsedAuthDate.toISOString(),
      date: parsedDate ? parsedDate.toISOString() : "",
      pending: false,
      merchant_name: t["Auftraggeber"] ?? "",
      name: t.Verwendungszweck ?? "",
      iso_currency_code: "EUR",
    };
  });
