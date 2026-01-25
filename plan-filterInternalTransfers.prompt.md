TL;DR — Use the DKB transaction payload (creditor/debtor account IBAN/accountNr) to detect transfers between the user’s synced accounts and mark them as internal transfers during sync (set `category: "internal-transfer"` and add a small marker under `raw` for inspection). Do not remove these transactions from storage; instead tag them so KPIs and analytics can ignore them. If a transaction lacks reliable account identifiers (no IBAN/accountNr), do not mark it (safer — Option C). Skip fuzzy matching for now (ignore edge-case heuristics).

User choices applied
- Missing IBANs / incomplete data: Option C — do NOT mark/filter when identifiers are missing.
- Mark vs delete: Mark — tag internal transfers (set `category` and raw marker) instead of deleting.
- Edge-case fuzzy matching: ignore (no fuzzy heuristics for now).

Refined Steps (concrete, per-file)
1) Core idea
   - Identify owned accounts' stable identifiers (IBAN and accountNr when available) from the accounts returned by the adapter. Build lookup maps from IBAN/accountNr to our unified `account.id`.
   - For each fetched transaction, examine the bank-provided creditor/debtor account objects (prefer IBAN, fallback to accountNr). If both sides are present and both resolve to owned accounts (and the other side is not the same account as the current account), mark the transaction as an internal transfer.
   - If either side is missing an identifier, do not mark (Option C).

2) Exact edits to implement (priority order)

- `src/lib/banking/sync.ts`
  - Build `ownAccountIdsByIban` and `ownAccountIdsByAccountNr` maps after fetching `accounts` (from `adapter.fetchAccounts`). Include `account.attributes.referenceAccount` values where present (the accounts response may carry `referenceAccount` with `iban`/`accountNumber`).
  - Add helper `function detectAndTagInternalTransfer(tx: UnifiedTransaction, currentAccountId: string, ownIbanMap, ownAccountNrMap): boolean` that:
    - Inspects `tx.raw?.attributes?.creditor?.creditorAccount` and `tx.raw?.attributes?.debtor?.debtorAccount`.
    - Extracts `creditorIban`, `creditorAccountNr`, `debtorIban`, `debtorAccountNr` (normalize whitespace, uppercase for IBANs).
    - If both sides present and both resolve to owned accounts via the maps, tag the transaction by setting `tx.category = 'internal-transfer'` and also `tx.raw = { ...tx.raw, __internalTransfer: true }` to keep a machine-readable marker.
    - Returns true if tagged, false otherwise.
  - After `const transactions = await adapter.fetchTransactions(...)` and mapping to unified transactions, iterate the mapped transactions and call `detectAndTagInternalTransfer` for each before dedup/insert. Continue to store all transactions (including marked internal ones).
  - Keep `transactionsFetched` equal to the number of transactions returned by the bank and `newTransactions` computed after dedup and insertion (i.e., count of transactions actually added to DB, regardless of marking).
  - Add small configuration constants at top of `sync.ts` like `const TAG_INTERNAL_TRANSFERS = true;` and `const EXCLUDE_INTERNAL_FROM_STATS = true;` as self-documenting toggles (so behavior can be toggled later).

- `src/actions/transactions.actions.ts` (optional — preserve current behavior)
  - No mandatory changes required here for marking. `getTransactions` currently returns stored transactions. If you prefer, we can add a flag to exclude `internal-transfer` by default (e.g. `excludeInternal?: boolean`) — I recommend adding this for convenience so UI/actions can explicitly request excluding internal transfers when used for KPIs. This is optional and described in Testing & Metrics below.

- `src/actions/stats.actions.ts`
  - Update the stats computation entrypoint to exclude transactions where `category === 'internal-transfer'` (respecting the `EXCLUDE_INTERNAL_FROM_STATS` toggle introduced in `sync.ts`, or better, check a local config flag in `stats.actions.ts`). This ensures KPI calculations (income/expense flows, category breakdowns) ignore internal transfers by default.

3) Behavior details & edge cases
- Prefer IBAN (normalized: remove spaces, uppercase) when present. If IBAN is missing on either side, check `accountNr` (exact string match). If neither side provides any identifier, do not mark the transaction — safer (Option C).
- Only tag when both parties can be resolved to owned accounts. If only one party resolves to an owned account and the other party lacks identifiers or maps to an unknown account, do not tag.
- Tagging will set `tx.category = 'internal-transfer'` and add a `__internalTransfer: true` entry under `tx.raw` to preserve provenance. This is type-safe because `category` is part of the `UnifiedTransaction` schema and `raw` is a free-record. We avoid adding new top-level fields to `UnifiedTransaction` to keep typings stable.

4) Tests & validation
- Unit tests (recommended):
  - Create small unit tests mocking `adapter.fetchAccounts()` to return 2 accounts (with IBANs) and `adapter.fetchTransactions()` to return 3 transactions: (A->B with IBANs), (B->A), and (A->external with only creditor/debtor name or missing identifiers). Assert that the first two transactions are tagged (category set) and the third is not.
  - Test that DB insertion still occurs for tagged transactions and dedup logic still prevents duplicates.
- Manual smoke test recipe:
  - Put valid DKB credentials in `banking.config.json`.
  - Sync once; inspect `data/db.json` (transactions array) for newly added transactions. Verify internal transfer transactions have `category: "internal-transfer"` and `raw.__internalTransfer: true`.
  - Trigger KPI pages (dashboard) and confirm that when `EXCLUDE_INTERNAL_FROM_STATS` or `stats` flags are enabled, the +/- mirror entries no longer move KPI numbers.

5) Rollout & optional improvements (post-merge)
- Add `excludeInternal` optional parameter to `getTransactions(filters, options?)` to easily fetch user-visible lists without internal transfers. Update UI components to use that when generating KPIs or visuals.
- Provide a small UI toggle or config in README to control whether internal transfers are excluded from dashboards or only visually hidden.
- If you later want to capture partial matches (missing IBANs) consider a fuzzy matching pass that uses last-n digits of account numbers or normalized counterpart names — keep that for a follow-up.

6) Requirements coverage mapping
- Eliminate internal-transfer distortion in KPIs: Done by tagging internal transfers and excluding them during KPI calculations (see `stats.actions.ts` change above).
- Preserve external transactions: Only tag when both sides are resolved to owned IBANs/account numbers; otherwise leave unchanged (Option C).
- Keep data auditable: Marking stores both `category` and a `raw.__internalTransfer` marker so users/developers can inspect why a transaction was considered internal.

Next step
- If you approve this refined plan I will update the repo with a small, well-scoped change set: implement helper and tagging in `src/lib/banking/sync.ts`, add `EXCLUDE_INTERNAL_FROM_STATS` behavior to `src/actions/stats.actions.ts`, and optionally add a small `excludeInternal` flag to `getTransactions`. I will run quick checks (type/lint) and a manual smoke test using the repo's local DB seed to ensure no regressions.

Notes
- I used the `filterInternalTransfers` filename as before. If you'd like a different name for the saved plan file, tell me and I'll rename it.
