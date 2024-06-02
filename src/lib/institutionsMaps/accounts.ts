import { BankAccountI} from "@/src/types";

export const dkbBankAccount: BankAccountI = {
  name: "DKB CSV import",
  account_id: "vgczt6sjaCc6xrKUe4uxc",
  institution_id: "ins_128043fake",
  balances: {
    current: 7444.44,
  },
};

export const dbBankAccount: BankAccountI = {
  name: "Deutsche Bank CSV import",
  account_id: "vgczt6sjaCc6xrKUe4uxcdb",
  institution_id: "ins_128043dbfake",
  balances: {
    current: 7444.44,
  },
};