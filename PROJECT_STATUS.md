# PROJECT STATUS - Finance Dashboard (Genesis)

> **Last Updated:** 2026-01-21
> **Current Phase:** Pre-Implementation (Plan Complete)
> **Status:** Ready to Start
> **DKB API Sample:** Received and analyzed

---

## Project Overview

| Attribute         | Value                                               |
|-------------------|-----------------------------------------------------|
| **Project Name**  | Sensitive Finance Dashboard (Genesis)               |
| **Architecture**  | Local-only SPA with DKB API sync                    |
| **Tech Stack**    | Vite + React 19 + TypeScript + Tailwind + shadcn/ui |
| **Storage**       | IndexedDB via Dexie.js                              |
| **Data Sources**  | DKB API (token paste), CSV fallback (Deutsche Bank) |
| **Multi-Account** | Yes, from day one                                   |

---

## Core Constraints (STRICT)

- **LOCAL-ONLY:** No server, no database, no cloud infrastructure
- **ZERO data transmission:** All processing happens client-side in the browser
- **No passwords/credentials stored:** Token paste approach (memory only)
- **Security-first:** Sensitive financial data never leaves the user's machine

---

## Architecture

### Data Flow

```
1. User logs into DKB in browser
2. Opens DevTools -> Network tab -> finds any API call
3. Copies Authorization header (Bearer token)
4. In Dashboard: clicks "Sync from DKB" -> pastes token
5. Dashboard fetches transactions directly (client-side)
6. Token stored ONLY in memory (discarded on page close)
7. Transactions stored in IndexedDB (persistent)
```

### System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER'S LOCAL BROWSER                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌──────────────┐    ┌───────────────┐    ┌───────────────┐   │
│   │  Token Paste │───>│  DKB API Call │───>│  Parser       │   │
│   │  (memory)    │    │  (client-side)│    │  (normalize)  │   │
│   └──────────────┘    └───────────────┘    └───────┬───────┘   │
│                                                     │           │
│   ┌──────────────┐                                  │           │
│   │  CSV Import  │──────────────────────────────────┤           │
│   │  (fallback)  │                                  │           │
│   └──────────────┘                                  │           │
│                                                     ▼           │
│   ┌──────────────────────────────────────────────────────────┐ │
│   │            IndexedDB (Persistent Local Storage)           │ │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │ │
│   │  │  Accounts   │  │Transactions │  │ Categories  │       │ │
│   │  │  (multi)    │  │  (dedupe)   │  │  (custom)   │       │ │
│   │  └─────────────┘  └─────────────┘  └─────────────┘       │ │
│   └────────────────────────┬─────────────────────────────────┘ │
│                            │                                    │
│                            ▼                                    │
│   ┌──────────────────────────────────────────────────────────┐ │
│   │                    Dashboard UI                           │ │
│   │  - Multi-account selector                                 │ │
│   │  - Transaction table with filters                         │ │
│   │  - Balance charts per account                             │ │
│   │  - Income/Expense analysis                                │ │
│   │  - Category breakdown                                     │ │
│   └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│   DATA NEVER LEAVES YOUR BROWSER - STORED IN IndexedDB         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Framework** | Vite + React 19 | Fastest DX, modern bundler, excellent for SPAs |
| **Language** | TypeScript | Type safety for financial data handling |
| **Styling** | Tailwind CSS + shadcn/ui | Modern, responsive, minimal bundle |
| **Charts** | ECharts | Powerful visualization for financial data |
| **State** | Zustand | Lightweight state management |
| **Data Persistence** | Dexie.js (IndexedDB) | Client-side only, persistent across sessions |
| **CSV Parsing** | PapaParse | Proven, fast CSV parsing in browser |
| **Date Handling** | date-fns | Lightweight date manipulation |
| **Icons** | Lucide React | Modern, tree-shakeable icons |

---

## Project Structure

```
finance-dashboard/
├── index.html
├── vite.config.ts
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
├── PROJECT_STATUS.md
│
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   │
│   ├── components/
│   │   ├── ui/                    # shadcn/ui components
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Layout.tsx
│   │   ├── dashboard/
│   │   │   ├── BalanceCard.tsx
│   │   │   ├── BalanceChart.tsx
│   │   │   ├── IncomeExpenseChart.tsx
│   │   │   ├── CategoryPieChart.tsx
│   │   │   └── AccountSelector.tsx
│   │   ├── transactions/
│   │   │   ├── TransactionTable.tsx
│   │   │   ├── TransactionRow.tsx
│   │   │   ├── TransactionFilters.tsx
│   │   │   └── CategoryBadge.tsx
│   │   └── sync/
│   │       ├── SyncDialog.tsx
│   │       ├── DkbSync.tsx
│   │       ├── CsvImport.tsx
│   │       └── SyncStatus.tsx
│   │
│   ├── lib/
│   │   ├── db/
│   │   │   ├── index.ts
│   │   │   ├── schema.ts
│   │   │   └── migrations.ts
│   │   ├── api/
│   │   │   ├── dkb.ts
│   │   │   └── types.ts
│   │   ├── parsers/
│   │   │   ├── index.ts
│   │   │   ├── dkb.parser.ts
│   │   │   └── csv.parser.ts
│   │   ├── categorizer.ts
│   │   ├── statistics.ts
│   │   └── utils.ts
│   │
│   ├── store/
│   │   ├── accounts.store.ts
│   │   ├── transactions.store.ts
│   │   └── sync.store.ts
│   │
│   ├── hooks/
│   │   ├── useTransactions.ts
│   │   ├── useAccounts.ts
│   │   ├── useStatistics.ts
│   │   └── useSync.ts
│   │
│   └── types/
│       ├── index.ts
│       ├── transaction.ts
│       └── account.ts
│
└── tests/
    ├── lib/
    │   ├── dkb.parser.test.ts
    │   └── categorizer.test.ts
    └── components/
        └── TransactionTable.test.tsx
```

---

## Type Definitions

```typescript
// Account
interface Account {
  id: string;                    // UUID from DKB or generated
  name: string;                  // User-friendly name
  bank: 'dkb' | 'deutsche-bank' | 'other';
  iban?: string;                 // Optional, for display
  balance: number;               // Current balance (cents)
  currency: string;              // EUR
  lastSynced?: Date;
  createdAt: Date;
}

// Transaction
interface Transaction {
  id: string;                    // Hash of unique fields
  accountId: string;             // FK to Account
  bookingDate: Date;
  valueDate: Date;
  amount: number;                // Cents (positive = income, negative = expense)
  currency: string;
  description: string;
  counterpartyName?: string;
  counterpartyIban?: string;
  category?: TransactionCategory;
  merchantName?: string;
  merchantCategory?: string;
  rawData: Record<string, any>;
  createdAt: Date;
}

// Categories
type TransactionCategory =
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
```

---

## DKB API Details

### Endpoint
```
GET https://banking.dkb.de/api/accounts/accounts/{accountId}/transactions
```

### Query Parameters
| Param | Example | Description |
|-------|---------|-------------|
| `filter[bookingDate][GE]` | `2015-01-01` | From date |
| `filter[bookingDate][LE]` | `2026-01-01` | To date |
| `expand` | `Merchant` | Include merchant data |
| `pagesize` | `50` | Results per page |

### Required Headers
```
Authorization: Bearer <token from DevTools>
Accept: application/json
```

### Response Structure (Confirmed from Sample)

```json
{
  "data": [
    {
      "type": "accountTransaction",
      "id": "2025-12-30-09.51.31.731904",
      "attributes": {
        "status": "booked",
        "bookingDate": "2025-12-30",
        "valueDate": "2025-12-30",
        "description": "VISA Debitkartenumsatz...",
        "endToEndId": "485363537425993",
        "transactionType": "KARTENZAHLUNG",
        "transactionTypeCode": "106",
        "purposeCode": "IDCP",
        "businessTransactionCode": "NDDT+106+9300+002",
        "amount": {
          "currencyCode": "EUR",
          "value": "-7.11"
        },
        "creditor": {
          "name": "MERCHANT NAME",
          "creditorAccount": {
            "accountNr": "...",
            "blz": "...",
            "iban": "DE..."
          },
          "agent": { "bic": "..." },
          "intermediaryName": "DEUTSCHE KREDITBANK AG"
        },
        "debtor": {
          "name": "ISSUER",
          "debtorAccount": {
            "accountNr": "...",
            "blz": "...",
            "iban": "DE..."
          },
          "agent": { "bic": "..." }
        },
        "isRevocable": false
      }
    }
  ],
  "included": []
}
```

### Field Mapping: DKB API -> Transaction

| DKB API Field | Transaction Field | Notes |
|---------------|-------------------|-------|
| `id` | `id` | Use as unique identifier |
| `attributes.bookingDate` | `bookingDate` | Parse as Date |
| `attributes.valueDate` | `valueDate` | Parse as Date |
| `attributes.amount.value` | `amount` | Convert to cents (multiply by 100) |
| `attributes.amount.currencyCode` | `currency` | Usually "EUR" |
| `attributes.description` | `description` | Full description text |
| `attributes.creditor.name` | `counterpartyName` | For outgoing payments |
| `attributes.creditor.creditorAccount.iban` | `counterpartyIban` | Optional |
| `attributes.transactionType` | Used for `category` | Map to category (see below) |
| `attributes.transactionTypeCode` | Stored in `rawData` | For reference |
| Entire object | `rawData` | Store original for debugging |

### Transaction Type -> Category Mapping

| transactionType | Category |
|-----------------|----------|
| `KARTENZAHLUNG` | Based on merchant (groceries, restaurants, etc.) |
| `RECHNUNG` | `utilities` or `other` |
| `ÜBERWEISUNG` | `transfer` |
| `GEHALT` | `income` |
| `LASTSCHRIFT` | `utilities` (direct debit) |
| `GUTSCHRIFT` | `income` |
| Default | `other` |

---

## Sprint Plan

### Sprint 1: Foundation (MVP)
**Goal:** Basic dashboard with transaction display and DKB sync

| # | Task | Agent | Status |
|---|------|-------|--------|
| 1.1 | Initialize Vite + React 19 + TypeScript | CoderAgent | Pending |
| 1.2 | Setup Tailwind CSS + PostCSS | CoderAgent | Pending |
| 1.3 | Install and configure shadcn/ui | Frontend Specialist | Pending |
| 1.4 | Create type definitions | CoderAgent | Pending |
| 1.5 | Setup Dexie.js + IndexedDB schema | CoderAgent | Pending |
| 1.6 | Build Layout (Header, Sidebar) | Frontend Specialist | Pending |
| 1.7 | Build TransactionTable component | Frontend Specialist | Pending |
| 1.8 | Implement DKB API client | CoderAgent | Pending |
| 1.9 | Build SyncDialog (token paste) | Frontend Specialist | Pending |
| 1.10 | Parse DKB response -> Transaction | CoderAgent | Pending |
| 1.11 | Write parser unit tests | TestEngineer | Pending |
| 1.12 | Security review | CodeReviewer | Pending |

---

### Sprint 2: Multi-Account & Analytics
**Goal:** Account management and basic charts

| # | Task | Agent | Status |
|---|------|-------|--------|
| 2.1 | Build AccountSelector component | Frontend Specialist | Pending |
| 2.2 | Implement account CRUD operations | CoderAgent | Pending |
| 2.3 | Build BalanceCard component | Frontend Specialist | Pending |
| 2.4 | Integrate ECharts | CoderAgent | Pending |
| 2.5 | Build BalanceChart (history) | Frontend Specialist | Pending |
| 2.6 | Build IncomeExpenseChart | Frontend Specialist | Pending |
| 2.7 | Implement statistics calculations | CoderAgent | Pending |
| 2.8 | Add transaction deduplication | CoderAgent | Pending |

---

### Sprint 3: Categorization & Filtering
**Goal:** Auto-categorize transactions, filter by date/category

| # | Task | Agent | Status |
|---|------|-------|--------|
| 3.1 | Implement auto-categorizer | CoderAgent | Pending |
| 3.2 | Build CategoryPieChart | Frontend Specialist | Pending |
| 3.3 | Build TransactionFilters | Frontend Specialist | Pending |
| 3.4 | Add date range picker | Frontend Specialist | Pending |
| 3.5 | Allow manual category override | CoderAgent | Pending |

---

### Sprint 4: Polish & Deutsche Bank
**Goal:** Deutsche Bank CSV, dark mode, responsive

| # | Task | Agent | Status |
|---|------|-------|--------|
| 4.1 | Build CsvImport component | Frontend Specialist | Pending |
| 4.2 | Create Deutsche Bank CSV parser | CoderAgent | Pending |
| 4.3 | Add dark/light theme toggle | Frontend Specialist | Pending |
| 4.4 | Mobile responsive design | Frontend Specialist | Pending |
| 4.5 | Add data export (JSON backup) | CoderAgent | Pending |
| 4.6 | Write user documentation | DocWriter | Pending |
| 4.7 | Final security audit | CodeReviewer | Pending |
| 4.8 | End-to-end testing | TestEngineer | Pending |

---

## Agent Assignments

| Agent | Role in Project |
|-------|-----------------|
| **CoderAgent** | Core logic, parsers, state management, data persistence |
| **Frontend Specialist** | UI components, charts, responsive design, theming |
| **TestEngineer** | Unit tests, integration tests, TDD |
| **CodeReviewer** | Security audits, code quality, best practices |
| **DocWriter** | User documentation, README |

---

## Security Measures

1. **Token NEVER written to localStorage/IndexedDB**
2. **Token NEVER logged to console**
3. **Token variable cleared after API call completes**
4. **Dashboard runs locally (file:// or localhost)**
5. **No analytics, no external requests**
6. **All financial data stays in browser IndexedDB**

---

## Before Starting: Required Inputs

1. **DKB API Response Sample** - COMPLETED (see `dkb_api_sample.json`)
2. **Deutsche Bank CSV Sample** - Pending (needed for Sprint 4)

---

## How to Start

To begin implementation, run:
```
> Start implementation
```

This will:
1. Initialize the Vite + React project
2. Set up Tailwind + shadcn/ui
3. Begin Sprint 1 tasks with agent delegation
