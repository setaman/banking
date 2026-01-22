import type { Transaction, TransactionCategory } from '../types';

/**
 * Categorization rule definition
 */
export interface CategorizationRule {
  category: TransactionCategory;
  patterns: string[];
  transactionTypes?: string[];
  description: string;
}

/**
 * Categorization rules for automatic transaction categorization
 * 
 * Rules are applied in order, first match wins.
 * Patterns are case-insensitive and support partial matching.
 */
export const CATEGORIZATION_RULES: CategorizationRule[] = [
  // Income patterns
  {
    category: 'income',
    patterns: [
      'gehalt', 'salary', 'lohn', 'wage', 'income',
      'gutschrift', 'bonus', 'provision', 'commission',
      'erstattung', 'refund', 'rückerstattung',
      'kindergeld', 'rente', 'pension',
    ],
    transactionTypes: ['SEPA-GUTSCHRIFT', 'GUTSCHRIFT'],
    description: 'Salary, bonuses, refunds, and other income',
  },

  // Groceries - German supermarkets and grocery stores
  {
    category: 'groceries',
    patterns: [
      'rewe', 'edeka', 'lidl', 'aldi', 'netto', 'penny',
      'kaufland', 'real', 'globus', 'hit', 'nahkauf',
      'tegut', 'famila', 'marktkauf', 'combi',
      'supermarkt', 'biomarkt', 'bio company',
      'denns', 'alnatura', 'basic',
      'lebensmittel', 'groceries',
    ],
    transactionTypes: ['KARTENZAHLUNG', 'LASTSCHRIFT'],
    description: 'Supermarkets and grocery shopping',
  },

  // Restaurants and food delivery
  {
    category: 'restaurants',
    patterns: [
      'restaurant', 'cafe', 'bar', 'bistro', 'pizzeria',
      'mcdonald', 'burger king', 'kfc', 'subway',
      'lieferando', 'deliveroo', 'uber eats', 'wolt',
      'pizza', 'sushi', 'asia', 'china', 'thai',
      'doner', 'kebab', 'imbiss', 'bakery', 'backerei',
      'starbucks', 'coffee', 'kaffee',
    ],
    transactionTypes: ['KARTENZAHLUNG'],
    description: 'Restaurants, cafes, and food delivery',
  },

  // Transport
  {
    category: 'transport',
    patterns: [
      'deutsche bahn', 'db bahn', 'db vertrieb',
      'flixbus', 'uber', 'taxi', 'bolt',
      'tankstelle', 'shell', 'aral', 'esso', 'jet', 'total',
      'benzin', 'diesel', 'fuel', 'gas station',
      'bvg', 'mvg', 'hvv', 'vrr', 'vbb', // Public transport
      'parkhaus', 'parking', 'parken',
      'car2go', 'miles', 'sixt', 'europcar',
      'verkehr', 'transport',
    ],
    transactionTypes: ['KARTENZAHLUNG', 'LASTSCHRIFT'],
    description: 'Transportation, fuel, parking, and car expenses',
  },

  // Utilities and recurring bills
  {
    category: 'utilities',
    patterns: [
      'stadtwerke', 'energie', 'energy', 'strom', 'gas',
      'wasser', 'water', 'heizung', 'heating',
      'internet', 'telekom', 'vodafone', 'o2', 'telefonica',
      '1&1', '1und1', 'unitymedia',
      'versicherung', 'insurance', 'allianz', 'ergo',
      'krankenkasse', 'health insurance', 'aok', 'tk',
      'miete', 'rent', 'nebenkosten',
      'gez', 'rundfunk',
    ],
    transactionTypes: ['LASTSCHRIFT', 'DAUERAUFTRAG'],
    description: 'Utilities, internet, insurance, and recurring bills',
  },

  // Shopping
  {
    category: 'shopping',
    patterns: [
      'amazon', 'ebay', 'zalando', 'otto', 'about you',
      'h&m', 'zara', 'primark', 'c&a', 'kaufhof',
      'saturn', 'media markt', 'mediamarkt',
      'ikea', 'baumarkt', 'obi', 'hornbach', 'bauhaus',
      'dm', 'rossmann', 'müller', 'douglas',
      'thalia', 'hugendubel', 'mayersche',
      'decathlon', 'intersport', 'sportcheck',
      'apple', 'samsung', 'electronics',
    ],
    transactionTypes: ['KARTENZAHLUNG', 'LASTSCHRIFT'],
    description: 'Online and offline shopping',
  },

  // Entertainment
  {
    category: 'entertainment',
    patterns: [
      'spotify', 'netflix', 'amazon prime', 'disney',
      'youtube', 'twitch', 'patreon',
      'kino', 'cinema', 'cinestar', 'cinemaxx',
      'steam', 'playstation', 'xbox', 'nintendo',
      'fitness', 'gym', 'mcfit', 'fitx', 'clever fit',
      'theater', 'konzert', 'concert', 'ticket',
      'museum', 'zoo', 'freizeitpark',
    ],
    transactionTypes: ['KARTENZAHLUNG', 'LASTSCHRIFT'],
    description: 'Entertainment, streaming, and leisure activities',
  },

  // Health
  {
    category: 'health',
    patterns: [
      'apotheke', 'pharmacy', 'arzt', 'doctor', 'zahnarzt',
      'krankenhaus', 'hospital', 'klinik', 'clinic',
      'physiotherapie', 'physio', 'massage',
      'optiker', 'glasses', 'brille',
      'medikament', 'medicine', 'gesundheit', 'health',
    ],
    transactionTypes: ['KARTENZAHLUNG', 'LASTSCHRIFT'],
    description: 'Healthcare, pharmacy, and medical expenses',
  },

  // Transfers
  {
    category: 'transfer',
    patterns: [
      'überweisung', 'transfer', 'dauerauftrag',
      'umbuchung', 'internal transfer',
    ],
    transactionTypes: ['ÜBERWEISUNG', 'SEPA-ÜBERWEISUNG', 'DAUERAUFTRAG'],
    description: 'Money transfers between accounts',
  },
];

/**
 * Categorize a transaction based on patterns and transaction type
 * 
 * @param transaction - Transaction to categorize
 * @returns Determined category or 'other' if no match
 * 
 * @example
 * ```typescript
 * const transaction = {
 *   description: 'REWE MARKT GmbH',
 *   transactionType: 'KARTENZAHLUNG',
 *   amount: -2599
 * };
 * 
 * const category = categorizeTransaction(transaction);
 * // Returns: 'groceries'
 * ```
 */
export function categorizeTransaction(transaction: Transaction): TransactionCategory {
  // If transaction already has a category, keep it
  if (transaction.category) {
    return transaction.category;
  }

  // Normalize text fields for pattern matching
  const description = (transaction.description || '').toLowerCase();
  const counterpartyName = (transaction.counterpartyName || '').toLowerCase();
  const merchantName = (transaction.merchantName || '').toLowerCase();
  const transactionType = (transaction.transactionType || '').toUpperCase();

  // Combine all searchable text
  const searchText = `${description} ${counterpartyName} ${merchantName}`;

  // Apply categorization rules in order
  for (const rule of CATEGORIZATION_RULES) {
    // Check transaction type match (if specified in rule)
    const typeMatches = !rule.transactionTypes || 
      rule.transactionTypes.some(type => transactionType.includes(type.toUpperCase()));

    if (!typeMatches) {
      continue;
    }

    // Check pattern match
    const patternMatches = rule.patterns.some(pattern => 
      searchText.includes(pattern.toLowerCase())
    );

    if (patternMatches) {
      return rule.category;
    }
  }

  // Default to 'other' if no match found
  return 'other';
}

/**
 * Batch categorize multiple transactions
 * 
 * @param transactions - Array of transactions to categorize
 * @returns Array of transactions with updated categories
 * 
 * @example
 * ```typescript
 * const categorized = categorizeTransactions(uncategorizedTransactions);
 * await upsertTransactions(categorized);
 * ```
 */
export function categorizeTransactions(transactions: Transaction[]): Transaction[] {
  return transactions.map(transaction => ({
    ...transaction,
    category: categorizeTransaction(transaction),
  }));
}

/**
 * Get categorization statistics
 * 
 * @param transactions - Array of transactions
 * @returns Statistics about categorization coverage
 * 
 * @example
 * ```typescript
 * const stats = getCategorizationStats(transactions);
 * // { total: 100, categorized: 85, uncategorized: 15, coverage: 0.85 }
 * ```
 */
export function getCategorizationStats(transactions: Transaction[]): {
  total: number;
  categorized: number;
  uncategorized: number;
  coverage: number;
} {
  const total = transactions.length;
  const categorized = transactions.filter(tx => 
    tx.category && tx.category !== 'other'
  ).length;
  const uncategorized = total - categorized;
  const coverage = total > 0 ? categorized / total : 0;

  return {
    total,
    categorized,
    uncategorized,
    coverage,
  };
}

/**
 * Get category suggestions for a transaction
 * Returns top 3 most likely categories based on pattern matching confidence
 * 
 * @param transaction - Transaction to analyze
 * @returns Array of category suggestions with confidence scores
 */
export function getCategorySuggestions(
  transaction: Transaction
): Array<{ category: TransactionCategory; confidence: number; reason: string }> {
  const description = (transaction.description || '').toLowerCase();
  const counterpartyName = (transaction.counterpartyName || '').toLowerCase();
  const merchantName = (transaction.merchantName || '').toLowerCase();
  const transactionType = (transaction.transactionType || '').toUpperCase();
  const searchText = `${description} ${counterpartyName} ${merchantName}`;

  const suggestions: Array<{ category: TransactionCategory; confidence: number; reason: string }> = [];

  for (const rule of CATEGORIZATION_RULES) {
    let confidence = 0;
    const matchedPatterns: string[] = [];

    // Check transaction type
    const typeMatches = !rule.transactionTypes || 
      rule.transactionTypes.some(type => transactionType.includes(type.toUpperCase()));
    
    if (typeMatches) {
      confidence += 0.2;
    }

    // Check pattern matches
    for (const pattern of rule.patterns) {
      if (searchText.includes(pattern.toLowerCase())) {
        matchedPatterns.push(pattern);
        confidence += 0.3;
      }
    }

    if (confidence > 0) {
      suggestions.push({
        category: rule.category,
        confidence: Math.min(confidence, 1),
        reason: matchedPatterns.length > 0 
          ? `Matched: ${matchedPatterns.join(', ')}`
          : 'Transaction type match',
      });
    }
  }

  // Sort by confidence and return top 3
  return suggestions
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}
