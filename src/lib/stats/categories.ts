/**
 * Transaction category classification rules.
 *
 * Maps keywords found in transaction descriptions/counterparties
 * to spending categories. German keywords included for DKB transactions.
 */

export const CATEGORIES = [
  "Groceries",
  "Rent & Housing",
  "Utilities",
  "Transport",
  "Dining & Restaurants",
  "Entertainment",
  "Shopping",
  "Health & Insurance",
  "Subscriptions",
  "Income",
  "Transfer",
  "Cash",
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
      "dm-drogerie",
      "rossmann",
      "supermarkt",
      "lebensmittel",
    ],
  },
  {
    category: "Rent & Housing",
    keywords: [
      "miete",
      "rent",
      "wohnung",
      "hausgeld",
      "nebenkosten",
      "immobilien",
    ],
  },
  {
    category: "Utilities",
    keywords: [
      "strom",
      "gas",
      "wasser",
      "stadtwerke",
      "vattenfall",
      "eon",
      "enpal",
      "telekom",
      "vodafone",
      "o2",
      "internet",
      "rundfunk",
      "gez",
    ],
  },
  {
    category: "Transport",
    keywords: [
      "db ",
      "bahn",
      "bvg",
      "mvg",
      "tankstelle",
      "shell",
      "aral",
      "uber",
      "bolt",
      "tier",
      "lime",
      "flixbus",
      "car2go",
      "sixt",
    ],
  },
  {
    category: "Dining & Restaurants",
    keywords: [
      "restaurant",
      "gastronomie",
      "lieferando",
      "delivery hero",
      "mcdonalds",
      "burger king",
      "starbucks",
      "cafe",
      "bistro",
      "pizza",
      "sushi",
    ],
  },
  {
    category: "Entertainment",
    keywords: [
      "kino",
      "cinema",
      "theater",
      "spotify",
      "netflix",
      "disney",
      "amazon prime",
      "youtube",
      "gaming",
      "playstation",
      "steam",
    ],
  },
  {
    category: "Shopping",
    keywords: [
      "amazon",
      "zalando",
      "h&m",
      "zara",
      "mediamarkt",
      "saturn",
      "ikea",
      "ebay",
      "otto",
      "about you",
    ],
  },
  {
    category: "Health & Insurance",
    keywords: [
      "apotheke",
      "arzt",
      "krankenhaus",
      "versicherung",
      "insurance",
      "krankenkasse",
      "aok",
      "tk ",
      "barmer",
      "fitnessstudio",
      "gym",
    ],
  },
  {
    category: "Subscriptions",
    keywords: [
      "abo",
      "subscription",
      "mitgliedschaft",
      "membership",
      "patreon",
      "cloud",
      "icloud",
      "google storage",
    ],
  },
  {
    category: "Income",
    keywords: [
      "gehalt",
      "salary",
      "lohn",
      "wage",
      "einnahme",
      "gutschrift",
      "erstattung",
      "refund",
      "dividende",
    ],
  },
  {
    category: "Transfer",
    keywords: [
      "umbuchung",
      "transfer",
      "überweisung eigen",
      "sparplan",
      "dauerauftrag eigen",
    ],
  },
  {
    category: "Cash",
    keywords: [
      "bargeld",
      "geldautomat",
      "atm",
      "cash",
      "abhebung",
      "withdrawal",
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
 * Batch-classify an array of transactions.
 */
export function classifyTransactions(
  transactions: { description: string; counterparty: string }[],
): Category[] {
  return transactions.map((tx) =>
    classifyTransaction(tx.description, tx.counterparty),
  );
}
