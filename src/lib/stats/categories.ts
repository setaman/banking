/**
 * Transaction category classification rules.
 *
 * Maps keywords found in transaction descriptions/counterparties
 * to spending categories. German keywords included for DKB transactions.
 */

import { UnifiedTransaction } from "@/lib/banking/types";

export const CATEGORIES = [
  "Groceries",
  "Bills",
  "Rent",
  "Transport",
  "Entertainment",
  "Healthcare",
  "Shopping",
  "Dining",
  "Subscriptions",
  "Income",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

interface CategoryRule {
  category: Category;
  keywords: string[];
}

const CATEGORY_RULES: CategoryRule[] = [
  {
    category: "Groceries",
    keywords: [
      "rewe",
      "edeka",
      "aldi",
      "lidl",
      "netto",
      "penny",
      "kaufland",
      "real",
      "dm-drogerie",
      "rossmann",
      "müller",
      "bio company",
      "denns",
      "tegut",
      "globus",
      "marktkauf",
      "famila",
      "nahkauf",
      "supermarkt",
      "lebensmittel",
    ],
  },
  {
    category: "Rent",
    keywords: [
      "miete",
      "rent",
      "vonovia",
      "deutsche wohnen",
      "hausverwaltung",
      "nebenkosten",
      "wohnungsgenossenschaft",
      "wohnung",
      "hausgeld",
      "immobilien",
    ],
  },
  {
    category: "Bills",
    keywords: [
      "stadtwerke",
      "vattenfall",
      "eon",
      "rwe",
      "telekom",
      "vodafone",
      "o2",
      "1&1",
      "versicherung",
      "insurance",
      "strom",
      "gas",
      "wasser",
      "internet",
      "telefon",
      "rundfunk",
      "gez",
      "ard zdf",
      "beitragsservice",
    ],
  },
  {
    category: "Transport",
    keywords: [
      "deutsche bahn",
      "db vertrieb",
      "db ",
      "bahn",
      "bvg",
      "mvg",
      "hvv",
      "vrs",
      "vrr",
      "rmv",
      "vbb",
      "verkehrsbetriebe",
      "flixbus",
      "uber",
      "bolt",
      "freenow",
      "free now",
      "tier",
      "lime",
      "shell",
      "aral",
      "total",
      "esso",
      "tankstelle",
      "car2go",
      "share now",
      "sixt",
      "taxi",
      "ticket",
      "fahrkarte",
    ],
  },
  {
    category: "Dining",
    keywords: [
      "restaurant",
      "mcdonald",
      "burger king",
      "kfc",
      "subway",
      "starbucks",
      "coffee",
      "cafe",
      "café",
      "pizzeria",
      "lieferando",
      "deliveroo",
      "uber eats",
      "wolt",
      "pizza",
      "sushi",
      "nordsee",
      "vapiano",
      "gastronomie",
      "delivery hero",
      "bistro",
      "imbiss",
      "gaststätte",
    ],
  },
  {
    category: "Entertainment",
    keywords: [
      "netflix",
      "spotify",
      "amazon prime",
      "disney",
      "sky",
      "dazn",
      "apple music",
      "youtube premium",
      "youtube",
      "kino",
      "cinema",
      "theater",
      "konzert",
      "concert",
      "ticketmaster",
      "eventim",
      "steam",
      "playstation",
      "xbox",
      "nintendo",
      "gaming",
    ],
  },
  {
    category: "Healthcare",
    keywords: [
      "apotheke",
      "pharmacy",
      "arzt",
      "doctor",
      "zahnarzt",
      "dentist",
      "krankenhaus",
      "hospital",
      "klinik",
      "clinic",
      "aok",
      "tk ",
      "barmer",
      "dak",
      "techniker krankenkasse",
      "krankenkasse",
      "fitnessstudio",
      "gym",
      "mcfit",
      "fitness first",
      "urban sports",
    ],
  },
  {
    category: "Shopping",
    keywords: [
      "amazon",
      "zalando",
      "otto",
      "ebay",
      "mediamarkt",
      "saturn",
      "ikea",
      "h&m",
      "zara",
      "c&a",
      "primark",
      "decathlon",
      "obi",
      "bauhaus",
      "hornbach",
      "paypal",
      "klarna",
      "about you",
    ],
  },
  {
    category: "Subscriptions",
    keywords: [
      "abo",
      "subscription",
      "mitgliedsbeitrag",
      "membership",
      "mitgliedschaft",
      "patreon",
      "cloud",
      "icloud",
      "google storage",
      "classpass",
      "zeitschrift",
      "magazine",
      "monatlich",
      "monthly",
      "jahresbeitrag",
    ],
  },
  {
    category: "Income",
    keywords: [
      "gehalt",
      "salary",
      "lohn",
      "wage",
      "überweisung",
      "rückerstattung",
      "refund",
      "erstattung",
      "bonus",
      "prämie",
      "einnahme",
      "gutschrift",
      "dividende",
    ],
  },
];

/**
 * Classifies a transaction into a category based on description and counterparty.
 */
export function classifyTransaction(
  description: string,
  counterparty: string,
): Category {
  const searchText = `${description} ${counterparty}`.toLowerCase();

  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => searchText.includes(kw))) {
      return rule.category;
    }
  }

  return "Other";
}

/**
 * Categorizes a transaction based on its direction and content.
 * Alias for classifyTransaction to match UnifiedTransaction interface.
 */
export function categorizeTransaction(
  transaction: UnifiedTransaction,
): Category {
  // Prioritize Income for credit transactions
  if (transaction.direction === "credit" && transaction.amount > 0) {
    const searchText =
      `${transaction.description} ${transaction.counterparty}`.toLowerCase();
    const incomeRule = CATEGORY_RULES.find((r) => r.category === "Income");
    if (
      incomeRule &&
      incomeRule.keywords.some((kw) => searchText.includes(kw))
    ) {
      return "Income";
    }
    // Default positive amounts to Income if no specific keyword match
    return "Income";
  }

  return classifyTransaction(transaction.description, transaction.counterparty);
}

/**
 * Batch-classify an array of transactions.
 */
export function classifyTransactions(
  transactions: { description: string; counterparty: string }[],
): Category[] {
  return transactions.map((tx) =>
    classifyTransaction(tx.description, tx.counterparty),
  );
}

// --- Recurring Transaction Detection ---

export interface RecurringTransactionGroup {
  counterparty: string;
  transactions: UnifiedTransaction[];
  averageAmount: number;
  averageInterval: number; // in days
  category: Category;
}

/**
 * Detects recurring transactions based on:
 * - Same counterparty
 * - Similar amount (within 10%)
 * - Regular intervals (28-32 days, typical monthly billing)
 *
 * Returns groups of recurring transactions sorted by frequency.
 */
export function detectRecurring(
  transactions: UnifiedTransaction[],
): RecurringTransactionGroup[] {
  // Group transactions by counterparty
  const byCounterparty = new Map<string, UnifiedTransaction[]>();

  for (const tx of transactions) {
    const key = tx.counterparty.trim().toLowerCase();
    if (!key) continue; // Skip transactions without counterparty

    if (!byCounterparty.has(key)) {
      byCounterparty.set(key, []);
    }
    byCounterparty.get(key)!.push(tx);
  }

  const recurringGroups: RecurringTransactionGroup[] = [];

  // Analyze each counterparty group
  for (const [, txs] of byCounterparty.entries()) {
    if (txs.length < 3) continue; // Need at least 3 transactions to detect pattern

    // Sort by date
    const sorted = [...txs].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    // Find clusters of similar amounts (within 10%)
    const clusters = findAmountClusters(sorted, 0.1);

    for (const cluster of clusters) {
      if (cluster.length < 3) continue; // Need at least 3 for recurring pattern

      // Check if intervals are regular (28-32 days)
      const intervals = calculateIntervals(cluster);
      const regularIntervals = intervals.filter((i) => i >= 28 && i <= 32);

      if (regularIntervals.length >= 2) {
        // At least 2 regular intervals = recurring pattern
        const avgAmount =
          cluster.reduce((sum, tx) => sum + Math.abs(tx.amount), 0) /
          cluster.length;
        const avgInterval =
          regularIntervals.reduce((sum, i) => sum + i, 0) /
          regularIntervals.length;

        recurringGroups.push({
          counterparty: cluster[0].counterparty,
          transactions: cluster,
          averageAmount: avgAmount,
          averageInterval: avgInterval,
          category: categorizeTransaction(cluster[0]),
        });
      }
    }
  }

  // Sort by number of occurrences (descending)
  return recurringGroups.sort(
    (a, b) => b.transactions.length - a.transactions.length,
  );
}

/**
 * Groups transactions into clusters based on similar amounts (within tolerance)
 */
function findAmountClusters(
  transactions: UnifiedTransaction[],
  tolerance: number,
): UnifiedTransaction[][] {
  const clusters: UnifiedTransaction[][] = [];

  for (const tx of transactions) {
    const amount = Math.abs(tx.amount);
    let foundCluster = false;

    // Try to add to existing cluster
    for (const cluster of clusters) {
      const clusterAvg =
        cluster.reduce((sum, t) => sum + Math.abs(t.amount), 0) /
        cluster.length;
      const diff = Math.abs(amount - clusterAvg) / clusterAvg;

      if (diff <= tolerance) {
        cluster.push(tx);
        foundCluster = true;
        break;
      }
    }

    // Create new cluster if no match
    if (!foundCluster) {
      clusters.push([tx]);
    }
  }

  return clusters;
}

/**
 * Calculates intervals (in days) between consecutive transactions
 */
function calculateIntervals(transactions: UnifiedTransaction[]): number[] {
  const intervals: number[] = [];

  for (let i = 1; i < transactions.length; i++) {
    const prevDate = new Date(transactions[i - 1].date);
    const currDate = new Date(transactions[i].date);
    const diffMs = currDate.getTime() - prevDate.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    intervals.push(diffDays);
  }

  return intervals;
}
