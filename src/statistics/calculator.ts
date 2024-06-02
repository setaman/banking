import { TransactionI, TransactionsGroupI } from "../types";
import { format } from "date-fns";

export function getTotalBalance(transactions: TransactionI[]): number {
  let expenses = getExpenses(transactions);
  let income = getIncome(transactions);
  
  return income - expenses;
}

export function getExpenses(transactions: TransactionI[]): number {
  let amount = 0;
  transactions.forEach(t => {
    amount += t.amount > 0 ? t.amount : 0;
  });   
  
  return amount;
}

export function getIncome(transactions: TransactionI[]): number {
  let amount = 0;
  transactions.forEach(t => {
    amount += t.amount < 0 ? t.amount : 0;
  });
  
  return amount * -1;
}

export function groupTransactionByDay(transactions: TransactionI[]): TransactionsGroupI[] { 
  return groupTransaction(transactions, "dd.MM.yyyy");
}

export function groupTransactionByDate (transactions: TransactionI[]): TransactionsGroupI[] {
  return groupTransaction(transactions, "MM.yyyy");
}

export function groupTransaction (transactions: TransactionI[], groupFormat: string) {
  const groups: TransactionsGroupI[] = [];

  for (const t of transactions) {
    const groupName = format(t.authorized_date, groupFormat);
    const group = groups.find((g) => g.group === groupName);
    if (group) {
      group.transactions.push(t);
    } else {
      groups.push({
        group: groupName,
        date: t.authorized_date,
        transactions: [t],
      });
    }
  }

  return groups;
}