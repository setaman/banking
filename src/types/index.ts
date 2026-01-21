// Transaction categories
export type TransactionCategory =
  | 'groceries'
  | 'restaurants'
  | 'transport'
  | 'utilities'
  | 'entertainment'
  | 'shopping'
  | 'health'
  | 'income'
  | 'transfer'
  | 'other';

// Bank types
export type BankType = 'dkb' | 'deutsche-bank' | 'other';

// Account interface
export interface Account {
  id: string;                    // UUID from DKB or generated
  name: string;                  // User-friendly name
  bank: BankType;
  iban?: string;                 // Optional, for display
  balance: number;               // Current balance (cents)
  currency: string;              // EUR
  lastSynced?: Date;
  createdAt: Date;
}

// Transaction interface
export interface Transaction {
  id: string;                    // Unique identifier from DKB or hash
  accountId: string;             // FK to Account
  bookingDate: Date;
  valueDate: Date;
  amount: number;                // Cents (positive = income, negative = expense)
  currency: string;
  description: string;
  counterpartyName?: string;
  counterpartyIban?: string;
  category?: TransactionCategory;
  transactionType?: string;      // DKB transaction type
  transactionTypeCode?: string;  // DKB type code
  merchantName?: string;
  merchantCategory?: string;
  rawData: Record<string, any>;  // Original API/CSV data
  createdAt: Date;
}

// Statistics interfaces
export interface AccountStatistics {
  accountId: string;
  totalIncome: number;           // cents
  totalExpenses: number;         // cents
  netChange: number;             // cents
  averageMonthlyIncome: number;  // cents
  averageMonthlyExpenses: number; // cents
  transactionCount: number;
  periodStart: Date;
  periodEnd: Date;
}

export interface CategoryBreakdown {
  category: TransactionCategory;
  amount: number;                // cents (always positive)
  count: number;
  percentage: number;            // 0-100
}

// DKB API types
export interface DKBApiTransaction {
  type: string;
  id: string;
  attributes: {
    status: string;
    bookingDate: string;
    valueDate: string;
    description: string;
    endToEndId?: string;
    transactionType: string;
    transactionTypeCode: string;
    purposeCode?: string;
    businessTransactionCode: string;
    amount: {
      currencyCode: string;
      value: string;
    };
    creditor?: {
      name: string;
      creditorAccount: {
        accountNr: string;
        blz?: string;
        iban?: string;
      };
      agent?: {
        bic: string;
      };
      intermediaryName?: string;
    };
    debtor?: {
      name: string;
      debtorAccount: {
        accountNr: string;
        blz?: string;
        iban?: string;
      };
      agent?: {
        bic: string;
      };
    };
    isRevocable: boolean;
  };
}

export interface DKBApiResponse {
  data: DKBApiTransaction[];
  included: any[];
  meta?: {
    totalPages?: number;
    currentPage?: number;
  };
}

// Sync status
export interface SyncStatus {
  isLoading: boolean;
  error?: string;
  lastSync?: Date;
  transactionCount?: number;
}
