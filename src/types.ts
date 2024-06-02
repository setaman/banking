export type UserI = {
  id: string;
  name: string;
};

export interface BankAccountI {
  account_id: string;
  institution_id?: string;
  item_id?: string;
  name: string;
  official_name?: string;
  persistent_account_id?: string;
  subtype?: string;
  type?: string;
  balances: {
    available?: number;
    current: number;
    iso_currency_code?: string;
    limit?: string;
    unofficial_currency_code?: null;
  };
}

export type TransactionI = {
  account_id: string;
  transaction_id: string;
  // https://plaid.com/docs/api/products/transactions/#transactions-sync-response-added-amount
  amount: number;
  authorized_date: string;
  date: string;
  iso_currency_code: string;
  merchant_name?: string;
  name?: string;
  authorized_datetime?: string;
  datetime?: string;
  /* @deprecated */
  transaction_type?: string;
  category?: string[];
  category_id?: string;
  logo_url?: string;
  merchant_entity_id?: string;
  payment_channel?: string;
  pending?: boolean;
  counter_parties?: {
    confidence_level?: string;
    entity_id?: string;
    logo_url?: string;
    name: string;
    phone_number?: null;
    type?: string;
    website?: string;
  }[];
};

export enum Institution {
  DKB = "DKB",
  DeutscheBank = 'Deutsche Bank'
}

export interface TransactionsGroupI {
  group: string;
  date: string;
  transactions: TransactionI[];
}

export interface StatsI {
  totalBalance: number;
  expenses: number;
  income: number;
  transactionsGroupByMonth: TransactionsGroupI[];
  transactionsGroupByDay: TransactionsGroupI[];
}

export interface TimeSeriesI {
  date: string;
  value: number;
}
