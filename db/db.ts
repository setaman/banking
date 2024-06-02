import { JSONFileSyncPreset } from "lowdb/node";
import { MemorySync, LowSync } from "lowdb";
import { BankAccountI, UserI, TransactionI } from "@/src/types";
import fs from "node:fs";
import path from "node:path";

type Data = {
  user: UserI | null;
  bankAccounts: BankAccountI[];
  transactions: TransactionI[];
};

const IS_IN_CLOUD = process.env.IS_IN_CLOUD === "true";
const DB_FILE_PATH = path.join(process.cwd(), "db.json");

const defaultData: Data = {
  user: null,
  bankAccounts: [],
  transactions: [],
};

console.log("IS_IN_CLOUD", IS_IN_CLOUD);
console.log("DB_FILE_PATH", DB_FILE_PATH);
console.log("process.cwd()", process.cwd());

if (!IS_IN_CLOUD && !fs.existsSync(DB_FILE_PATH)) {
  fs.writeFileSync(DB_FILE_PATH, JSON.stringify(defaultData));
}

const db = IS_IN_CLOUD
  ? new LowSync(new MemorySync<Data>(), {
      ...defaultData,
      user: { name: "Cloud User", id: "cloud-user" },
    })
  : JSONFileSyncPreset(DB_FILE_PATH, defaultData);

db.read();

export const User = {
  get: () => db.data.user,
  set: (user: UserI) => {
    db.data.user = user;
    return db.write();
  },
};

export const Banks = {
  get: () => db.data.bankAccounts,
  getById: (id: string) =>
    db.data.bankAccounts.find((bank: BankAccountI) => bank.account_id === id),
  insert: (bank: BankAccountI) => {
    db.data.bankAccounts.push(bank);
    return db.write();
  },
  removeById: (id: string) => {
    db.data.bankAccounts = db.data.bankAccounts.filter(
      (bank: BankAccountI) => bank.account_id !== id
    );
    return db.write();
  },
  count: () => db.data.bankAccounts.length,
};

export const Transactions = {
  get: () => db.data.transactions,
  getById: (id: string) =>
    db.data.transactions.find((t) => t.transaction_id === id),
  getByAccountId: (bankAccountId: string) =>
    db.data.transactions.filter((t) => t.account_id === bankAccountId),
  insert: (transaction: TransactionI) => {
    db.data.transactions.unshift(transaction);
    return db.write();
  },
  insertBulk: (transactions: TransactionI[]) => {
    db.data.transactions.unshift(...transactions);
    return db.write();
  },
  removeById: (id: string) => {
    db.data.transactions = db.data.transactions.filter(
      (t) => t.transaction_id !== id
    );
    return db.write();
  },
  search: (callback: (t: TransactionI) => boolean) => {
    db.data.transactions = db.data.transactions.filter(callback);
    return db.write();
  },
};
