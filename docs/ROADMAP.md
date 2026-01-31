# Implementation Roadmap

**Project:** BanKing
**Last Updated:** 2026-01-31

---

## Phase Overview

| Phase       | Focus                               | Status      |
| ----------- | ----------------------------------- | ----------- |
| Phase 0     | Foundation (UI, theme, layout)      | DONE        |
| Phase 1     | Data Layer & Banking Interface      | DONE        |
| Phase 2     | DKB API Integration & Sync          | DONE        |
| Phase 3     | Dashboard Charts & KPIs             | DONE        |
| Phase 4     | Filters, Transactions Page & Polish | DONE        |
| Phase 5     | Demo Mode & Extended Metrics        | DONE        |
| **Phase 6** | **Sync & Test-Mode Improvements**   | **PLANNED** |

---

## Phase 1: Data Layer & Banking Interface

**Goal:** Establish the unified banking interface, database layer, and type system.

### Tasks (Backend)

| ID  | Task                                          | Agent     | Dependencies |
| --- | --------------------------------------------- | --------- | ------------ |
| 1.1 | Install dependencies (zod, lowdb, date-fns)   | Dev       | None         |
| 1.2 | Define unified banking types with Zod schemas | Architect | None         |
| 1.3 | Set up LowDB with database schema             | Data Eng  | 1.1, 1.2     |
| 1.4 | Create BankAdapter interface                  | Architect | 1.2          |
| 1.5 | Implement credentials config reader           | Dev       | None         |
| 1.6 | Create server actions scaffold (sync, query)  | Dev       | 1.3          |

### Deliverables

- `src/lib/banking/types.ts` - Unified types + Zod schemas
- `src/lib/db/index.ts` - LowDB setup
- `src/lib/db/schema.ts` - Database schema
- `src/config/credentials.ts` - Config reader
- `src/actions/*.actions.ts` - Server action stubs

---

## Phase 2: DKB API Integration & Sync

**Goal:** Connect to DKB API, map responses to unified interface, sync and persist data.

### Tasks (Backend)

| ID  | Task                                                              | Agent    | Dependencies       |
| --- | ----------------------------------------------------------------- | -------- | ------------------ |
| 2.1 | Implement DKB API client (fetch accounts, transactions, balances) | Dev      | 1.5                |
| 2.2 | Create DKB → Unified mapper with Zod transform                    | Data Eng | 1.2, 1.4           |
| 2.3 | Implement SHA256 transaction deduplication                        | Dev      | 1.2                |
| 2.4 | Build sync orchestrator (fetch → map → dedupe → persist)          | Dev      | 2.1, 2.2, 2.3, 1.3 |
| 2.5 | Create sync API route (trigger on app start)                      | Dev      | 2.4                |
| 2.6 | Balance history: store timestamped balances on each sync          | Data Eng | 2.4                |

### Deliverables

- `src/lib/banking/adapters/dkb/api.ts` - DKB API client
- `src/lib/banking/adapters/dkb/mapper.ts` - Response mapper
- `src/lib/banking/sync.ts` - Sync orchestrator
- `src/app/api/sync/route.ts` - Sync endpoint

---

## Phase 3: Dashboard Charts & KPIs

**Goal:** Replace mock data with real data, add charts and core KPI calculations.

### Tasks (Frontend + Backend)

| ID   | Task                                             | Agent    | Dependencies |
| ---- | ------------------------------------------------ | -------- | ------------ |
| 3.1  | Install charting library (Recharts)              | Dev      | None         |
| 3.2  | Implement statistics calculations module         | Dev      | 1.2          |
| 3.3  | Build category classification logic              | Data Eng | 1.2          |
| 3.4  | Create Balance History chart (area chart)        | Frontend | 3.1, 2.6     |
| 3.5  | Create Income vs Expenses chart (bar chart)      | Frontend | 3.1, 3.2     |
| 3.6  | Create Spending by Category chart (donut)        | Frontend | 3.1, 3.3     |
| 3.7  | Update KPI cards with real calculations          | Frontend | 3.2          |
| 3.8  | Wire dashboard page to server actions            | Frontend | 1.6, 3.4-3.7 |
| 3.9  | Implement "Weekend vs Weekday" calculation logic | Dev      | 3.2          |
| 3.10 | Implement "Recurring Expense" detection logic    | Dev      | 3.3          |

### Deliverables

- `src/lib/stats/calculations.ts` - All KPI formulas
- `src/lib/stats/categories.ts` - Category rules
- Updated dashboard components with real data

---

## Phase 4: Filters, Transactions Page & Polish

**Goal:** Full filtering, dedicated transactions page, responsive polish.

### Tasks (Frontend)

| ID  | Task                                               | Agent    | Dependencies |
| --- | -------------------------------------------------- | -------- | ------------ |
| 4.1 | Build DateRangePicker component (presets + custom) | Frontend | None         |
| 4.2 | Create Transactions page with table                | Frontend | 1.6          |
| 4.3 | Add category filter to transactions                | Frontend | 3.3          |
| 4.4 | Add account filter to transactions                 | Frontend | 1.6          |
| 4.5 | Connect date range to all dashboard metrics        | Frontend | 4.1, 3.8     |
| 4.6 | Mobile responsive pass on all views                | UX       | 4.2          |

### Deliverables

- `src/components/dashboard/date-range-picker.tsx`
- `src/app/(dashboard)/transactions/page.tsx`
- Updated filters across dashboard

---

## Phase 5: Banking Insights & Demo Mode

**Goal:** Advanced behavioral analytics ("Insights" view), demo data generator, and final polish.

### Tasks

| 5.1 | Create demo data seed generator (realistic 6-month dataset) | Data Eng | 1.2 |
| 5.2 | Add demo mode toggle (header UI + state) | Frontend | 5.1 |
| 5.3 | Implement "Insights" page layout (Neo-Glass grid) | Frontend | 5.2 |
| 5.4 | Build "Weekend vs Weekday" visualization (Heatmap/Bar) | Frontend | 3.9, 5.3 |
| 5.5 | Build "Safety Net" Gauge widget | Frontend | 3.2, 5.3 |
| 5.6 | Build "Recurring Expenses" stack widget | Frontend | 3.10, 5.3 |
| 5.7 | Final QA pass (error handling, edge cases) | QA | All |

### Deliverables

- `src/app/(dashboard)/insights/page.tsx` - New Insights Page
- `src/lib/db/seed.ts` - Demo data generator
- Behavioral Analytics Widgets
- Demo mode toggle in header

---

## Sprint 1 Plan (Phase 1)

**Objective:** Get the data foundation in place so all subsequent work can build on real types and persistence.

### Sprint 1 Backlog

```
Priority 1 (Must Have):
├── Install core deps (zod, lowdb, date-fns)
├── Define unified Zod schemas (Account, Transaction, Balance)
├── Set up LowDB with typed schema
└── Create server actions scaffold

Priority 2 (Should Have):
├── Credentials config reader
├── BankAdapter interface definition
└── Database read/write helpers

Priority 3 (Nice to Have):
└── Unit type tests for Zod schemas
```

### Parallel Work Streams

```
Stream A (Architect/Data):        Stream B (Frontend):
─────────────────────────        ─────────────────────
1. Unified types + Zod           1. Install charting lib
2. BankAdapter interface         2. Research chart components
3. DB schema design              3. Prepare dashboard layout
                                    for real data slots
```

### Sprint 1 Acceptance Criteria

- [ ] `npm run build` passes with new files
- [ ] Zod schemas validate sample DKB-like data
- [ ] LowDB can read/write accounts, transactions, balances
- [ ] Server actions can query the database
- [ ] Credentials reader loads from `banking.config.json`

---

## Dependency Graph

```
Phase 0 (DONE)
    │
    ▼
Phase 1 ──────────────────┐
(Data Layer)               │
    │                      │
    ▼                      ▼
Phase 2              Phase 3 (partial)
(DKB Sync)           (Chart setup)
    │                      │
    ▼                      │
Phase 3 ◄─────────────────┘
(Dashboard + KPIs)
    │
    ▼
Phase 4
(Filters + Transactions)
    │
    ▼
Phase 5
(Demo + Extended KPIs)
    │
    ▼
Phase 6         ◄──── CURRENT
(Sync & Test-Mode Improvements)
```

---

## Phase 6: Sync & Test-Mode Improvements

**Goal:** Fix critical UX issues with sync triggering and demo mode data management.

**Full Specification:** `docs/SYNC-TESTMODE-IMPROVEMENT-PLAN.md`

### Problem Statement

| Issue                  | Impact                                          | Priority |
| ---------------------- | ----------------------------------------------- | -------- |
| No UI sync trigger     | Users can't refresh data without server restart | Critical |
| Demo mode wipes data   | Real transactions destroyed on toggle           | Critical |
| No last sync indicator | Users don't know if data is current             | High     |
| Stale data after sync  | LowDB caching prevents UI updates               | High     |

### Tasks

| ID   | Task                                                    | Agent    | Dependencies  | Complexity |
| ---- | ------------------------------------------------------- | -------- | ------------- | ---------- |
| 6.1  | Create `storage.ts` with DB path constants              | Backend  | None          | Low        |
| 6.2  | Add `invalidateDbCache()`, `setDbMode()` to db/index.ts | Backend  | 6.1           | Medium     |
| 6.3  | Rewrite `demo.actions.ts` with mode switching           | Backend  | 6.2           | Medium     |
| 6.4  | Enhance `sync.actions.ts` with `getSyncStatus()`        | Backend  | 6.2           | Medium     |
| 6.5  | Create `SyncProvider` context                           | Frontend | 6.4           | Medium     |
| 6.6  | Create `SyncButton` component                           | Frontend | 6.5           | Medium     |
| 6.7  | Create `SyncStatus` component                           | Frontend | 6.5           | Low        |
| 6.8  | Add confirmation dialog to `DemoToggle`                 | Frontend | 6.3           | Medium     |
| 6.9  | Update `Header.tsx` with sync controls                  | Frontend | 6.6, 6.7, 6.8 | Medium     |
| 6.10 | Add `SyncProvider` to `layout.tsx`                      | Frontend | 6.5           | Low        |
| 6.11 | Install shadcn AlertDialog & Tooltip                    | Setup    | None          | Low        |
| 6.12 | End-to-end testing                                      | QA       | All           | Medium     |

### Deliverables

- `src/lib/db/storage.ts` - DB path constants
- `src/contexts/sync-context.tsx` - Sync state management
- `src/components/sync-button.tsx` - Sync trigger button
- `src/components/sync-status.tsx` - Last sync display
- Updated `Header.tsx` with sync controls
- Updated `demo.actions.ts` with safe mode switching

### Acceptance Criteria

- [ ] Users can trigger sync via header button
- [ ] Last sync time displays and updates correctly
- [ ] Demo mode toggle preserves real data
- [ ] UI refreshes immediately after sync
- [ ] Error states are clearly communicated
- [ ] Mobile experience is functional
