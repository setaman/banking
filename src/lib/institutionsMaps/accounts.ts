import { BankAccountI } from "@/src/types";

export const dkbBankAccount: BankAccountI = {
  name: "DKB CSV import",
  account_id: "vgczt6sjaCc6xrKUe4uxc",
  institution_id: "ins_128043fake",
  logo: "https://www.dkb-service-gmbh.de/_assets/77dfbb5f2e7d6fb9aebb93141df10575/Icons/DKB-Service-Logo.svg",
  balances: {
    current: 7444.44,
  },
};

export const dbBankAccount: BankAccountI = {
  name: "Deutsche Bank CSV import",
  account_id: "vgczt6sjaCc6xrKUe4uxcdb",
  institution_id: "ins_128043dbfake",
  logo: "https://cdn.worldvectorlogo.com/logos/deutsche-bank-logo-without-wordmark.svg",
  balances: {
    current: 7444.44,
  },
};
