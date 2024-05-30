import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import currency from "currency.js";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const EURO = (value: string | number) =>
  currency(value, { symbol: "€", decimal: ",", separator: "." });
