import { TransactionI } from "../types";

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