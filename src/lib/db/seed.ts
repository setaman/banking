import { subMonths, format, addDays } from "date-fns";
import type {
  UnifiedAccount,
  UnifiedBalance,
  UnifiedTransaction,
} from "@/lib/banking/types";
import { classifyTransaction } from "@/lib/stats/categories";
import { createTransactionId } from "@/lib/banking/utils";
import type { Database } from "./schema";
import { getDb } from "./index";

const DEMO_ACCOUNTS: UnifiedAccount[] = [
  {
    id: "demo_checking",
    externalId: "demo_1",
    institutionId: "demo",
    name: "Girokonto",
    type: "checking",
    currency: "EUR",
    iban: "DE89 3704 0044 0532 0130 00",
  },
  {
    id: "demo_savings",
    externalId: "demo_2",
    institutionId: "demo",
    name: "Tagesgeldkonto",
    type: "savings",
    currency: "EUR",
    iban: "DE27 1007 0024 0066 4440 00",
  },
];

interface TransactionTemplate {
  description: string;
  counterparty: string;
  amountRange: [number, number];
  direction: "debit" | "credit";
  frequency: "monthly" | "weekly" | "biweekly" | "random";
  probability?: number; // 0-1, for random frequency
}

const RECURRING_TEMPLATES: TransactionTemplate[] = [
  // Income
  {
    description: "Gehaltszahlung",
    counterparty: "TechCorp GmbH",
    amountRange: [3800, 4200],
    direction: "credit",
    frequency: "monthly",
  },
  // Fixed costs
  {
    description: "Miete Wohnung",
    counterparty: "Hausverwaltung Mueller",
    amountRange: [950, 950],
    direction: "debit",
    frequency: "monthly",
  },
  {
    description: "Strom/Gas Abschlag",
    counterparty: "Vattenfall Europe",
    amountRange: [85, 95],
    direction: "debit",
    frequency: "monthly",
  },
  {
    description: "Internet DSL",
    counterparty: "Deutsche Telekom AG",
    amountRange: [45, 45],
    direction: "debit",
    frequency: "monthly",
  },
  {
    description: "Krankenversicherung",
    counterparty: "TK Techniker Krankenkasse",
    amountRange: [220, 220],
    direction: "debit",
    frequency: "monthly",
  },
  {
    description: "Spotify Premium",
    counterparty: "Spotify AB",
    amountRange: [10.99, 10.99],
    direction: "debit",
    frequency: "monthly",
  },
  {
    description: "Netflix Abo",
    counterparty: "Netflix International",
    amountRange: [12.99, 12.99],
    direction: "debit",
    frequency: "monthly",
  },
  {
    description: "BVG Monatskarte",
    counterparty: "BVG Abo",
    amountRange: [86, 86],
    direction: "debit",
    frequency: "monthly",
  },
  {
    description: "Fitnessstudio",
    counterparty: "McFit GmbH",
    amountRange: [29.99, 29.99],
    direction: "debit",
    frequency: "monthly",
  },
];

const VARIABLE_TEMPLATES: TransactionTemplate[] = [
  {
    description: "Einkauf REWE",
    counterparty: "REWE Markt",
    amountRange: [15, 85],
    direction: "debit",
    frequency: "random",
    probability: 0.4,
  },
  {
    description: "Einkauf EDEKA",
    counterparty: "EDEKA Center",
    amountRange: [10, 60],
    direction: "debit",
    frequency: "random",
    probability: 0.25,
  },
  {
    description: "Einkauf dm-drogerie",
    counterparty: "dm-drogerie markt",
    amountRange: [8, 35],
    direction: "debit",
    frequency: "random",
    probability: 0.1,
  },
  {
    description: "Restaurant",
    counterparty: "Restaurant Bella Italia",
    amountRange: [25, 75],
    direction: "debit",
    frequency: "random",
    probability: 0.15,
  },
  {
    description: "Lieferando Bestellung",
    counterparty: "Lieferando",
    amountRange: [15, 40],
    direction: "debit",
    frequency: "random",
    probability: 0.12,
  },
  {
    description: "Amazon Marketplace",
    counterparty: "Amazon EU S.a.r.l.",
    amountRange: [10, 150],
    direction: "debit",
    frequency: "random",
    probability: 0.08,
  },
  {
    description: "Bargeldabhebung",
    counterparty: "Geldautomat",
    amountRange: [50, 200],
    direction: "debit",
    frequency: "random",
    probability: 0.06,
  },
  {
    description: "Cafe Bestellung",
    counterparty: "Starbucks Coffee",
    amountRange: [4, 8],
    direction: "debit",
    frequency: "random",
    probability: 0.2,
  },
  {
    description: "Tankstelle",
    counterparty: "Shell Station",
    amountRange: [45, 80],
    direction: "debit",
    frequency: "random",
    probability: 0.05,
  },
  {
    description: "Überweisung",
    counterparty: "Max Mustermann",
    amountRange: [20, 100],
    direction: "credit",
    frequency: "random",
    probability: 0.04,
  },
];

function randomInRange(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/**
 * Generates 6 months of realistic demo transaction data.
 */
export function generateDemoData(): Database {
  const now = new Date();
  const startDate = subMonths(now, 6);
  const transactions: UnifiedTransaction[] = [];
  const balances: UnifiedBalance[] = [];
  const random = seededRandom(42); // Deterministic for consistency

  let checkingBalance = 5200; // Starting balance
  const savingsBalance = 12500;

  // Generate transactions day by day
  let currentDate = startDate;
  while (currentDate <= now) {
    const dayOfMonth = currentDate.getDate();
    const dateStr = format(currentDate, "yyyy-MM-dd");

    // Monthly recurring on specific days
    if (dayOfMonth === 1) {
      for (const template of RECURRING_TEMPLATES) {
        if (template.frequency !== "monthly") continue;
        const amount = randomInRange(...template.amountRange);
        const tx = createTransaction(
          template,
          amount,
          dateStr,
          "demo_checking"
        );
        transactions.push(tx);
        checkingBalance += template.direction === "credit" ? amount : -amount;
      }
    }

    // Variable expenses
    for (const template of VARIABLE_TEMPLATES) {
      if (random() < (template.probability ?? 0.1)) {
        const amount = randomInRange(...template.amountRange);
        const tx = createTransaction(
          template,
          amount,
          dateStr,
          "demo_checking"
        );
        transactions.push(tx);
        checkingBalance += template.direction === "credit" ? amount : -amount;
      }
    }

    // Store weekly balance snapshots
    if (currentDate.getDay() === 0) {
      balances.push({
        accountId: "demo_checking",
        amount: Math.round(checkingBalance * 100) / 100,
        currency: "EUR",
        fetchedAt: new Date(dateStr).toISOString(),
      });
      balances.push({
        accountId: "demo_savings",
        amount: savingsBalance,
        currency: "EUR",
        fetchedAt: new Date(dateStr).toISOString(),
      });
    }

    currentDate = addDays(currentDate, 1);
  }

  // Final balance snapshot
  balances.push({
    accountId: "demo_checking",
    amount: Math.round(checkingBalance * 100) / 100,
    currency: "EUR",
    fetchedAt: now.toISOString(),
  });
  balances.push({
    accountId: "demo_savings",
    amount: savingsBalance,
    currency: "EUR",
    fetchedAt: now.toISOString(),
  });

  return {
    accounts: DEMO_ACCOUNTS,
    transactions,
    balances,
    syncHistory: [
      {
        institutionId: "demo",
        lastSyncAt: now.toISOString(),
        accountsSynced: 2,
        transactionsFetched: transactions.length,
        newTransactions: transactions.length,
        status: "success",
      },
    ],
    meta: {
      version: 1,
      createdAt: now.toISOString(),
      lastModifiedAt: now.toISOString(),
      isDemoMode: true,
    },
  };
}

function createTransaction(
  template: TransactionTemplate,
  amount: number,
  date: string,
  accountId: string
): UnifiedTransaction {
  const tx: UnifiedTransaction = {
    id: "",
    accountId,
    date,
    bookingDate: date, // Use same date for demo data (no execution delay)
    amount: template.direction === "debit" ? -amount : amount,
    currency: "EUR",
    description: template.description,
    counterparty: template.counterparty,
    direction: template.direction,
    category: classifyTransaction(template.description, template.counterparty),
  };
  tx.id = createTransactionId(tx);
  return tx;
}

/**
 * Seeds the database with demo data.
 * Generates 6 months of realistic transactions and writes to db.json.
 */
export async function seedDemoData(): Promise<void> {
  const db = await getDb();
  const demoData = generateDemoData();

  db.data = demoData;
  await db.write();
}
