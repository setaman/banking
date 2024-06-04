import { JSONFileSyncPreset } from "lowdb/node";
import { MemorySync, LowSync } from "lowdb";
import { BankAccountI, UserI, TransactionI } from "@/src/types";
import fs from "node:fs";
import path from "node:path";
import {
  dbBankAccount,
  dkbBankAccount,
} from "@/src/lib/institutionsMaps/accounts";
import { faker } from "@faker-js/faker";

type Data = {
  user: UserI;
  bankAccounts: BankAccountI[];
  transactions: TransactionI[];
};

const createDefaultUser = (): UserI => ({
  id: faker.string.uuid(),
  name: faker.person.fullName(),
});

const IS_IN_CLOUD = process.env.IS_IN_CLOUD === "true";
const DB_FILE_PATH = path.join(process.cwd(), "db.json");

console.log("=>(db.ts:21) DB_FILE_PATH", DB_FILE_PATH);

const defaultData: Data = {
  user: createDefaultUser(),
  bankAccounts: [dkbBankAccount, dbBankAccount],
  transactions: [],
};

if (!IS_IN_CLOUD && !fs.existsSync(DB_FILE_PATH)) {
  fs.writeFileSync(DB_FILE_PATH, JSON.stringify(defaultData));
}

export class DbConnector {
  readonly db: LowSync<Data>;
  constructor() {
    this.db = IS_IN_CLOUD
      ? new LowSync(new MemorySync<Data>(), defaultData)
      : JSONFileSyncPreset(DB_FILE_PATH, defaultData);
    this.db.read();
  }
}

export class User extends DbConnector {
  get = () => this.db.data.user;
  set = (user: UserI) => {
    this.db.data.user = user;
    return this.db.write();
  };
}

export class Banks extends DbConnector {
  get = () => this.db.data.bankAccounts;
  getById = (id: string) =>
    this.db.data.bankAccounts.find(
      (bank: BankAccountI) => bank.account_id === id
    );
  insert = (bank: BankAccountI) => {
    this.db.data.bankAccounts.push(bank);
    return this.db.write();
  };
  removeById = (id: string) => {
    this.db.data.bankAccounts = this.db.data.bankAccounts.filter(
      (bank: BankAccountI) => bank.account_id !== id
    );
    return this.db.write();
  };
  count = () => this.db.data.bankAccounts.length;
}

export class Transactions extends DbConnector {
  get = () => this.db.data.transactions;
  getById = (id: string) =>
    this.db.data.transactions.find((t) => t.transaction_id === id);
  getByAccountId = (bankAccountId: string) =>
    this.db.data.transactions.filter((t) => t.account_id === bankAccountId);
  insert = (transaction: TransactionI) => {
    this.db.data.transactions.unshift(transaction);
    return this.db.write();
  };
  insertBulk = (transactions: TransactionI[]) => {
    this.db.data.transactions.unshift(...transactions);
    return this.db.write();
  };
}
