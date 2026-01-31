# Phase 6 Implementation Kick-off Prompt

Use this prompt to start implementation of the Sync & Test-Mode improvements.

---

## Implementation Prompt

````
Implement Phase 6: Sync & Test-Mode Improvements for the BanKing application.

## Context

Read the full implementation plan at `docs/SYNC-TESTMODE-IMPROVEMENT-PLAN.md`. This plan addresses four critical UX issues:

1. No way to trigger sync via UI
2. Demo mode destroys real data when toggled
3. No indication of last sync time
4. Data only available after server restart (stale cache)

## Implementation Order

Execute these steps in order, testing after each phase:

### Phase A: Database Layer (Backend First)

1. **Create `src/lib/db/storage.ts`:**
   - Export `DB_PATHS` object with paths for `real`, `demo`, and `backup`
   - Export `DbMode` type

2. **Modify `src/lib/db/index.ts`:**
   - Add `currentMode` variable (default: "real")
   - Modify `getDb()` to use `DB_PATHS[currentMode]`
   - Add `invalidateDbCache()` function that sets `dbInstance = null`
   - Add `setDbMode(mode: DbMode)` function
   - Add `getDbMode()` function
   - Update `resetDb()` to call `invalidateDbCache()` after write

3. **Modify `src/lib/db/schema.ts`:**
   - Add `lastSyncAt: z.string().datetime().optional()` to meta schema

4. **Modify `src/lib/banking/sync.ts`:**
   - Import and call `invalidateDbCache()` after `db.write()`

### Phase B: Server Actions

5. **Rewrite `src/actions/demo.actions.ts`:**
   - Import `setDbMode`, `getDbMode`, `invalidateDbCache` from db
   - `enableDemoMode()`: Call `setDbMode("demo")`, generate demo data if needed, `invalidateDbCache()`, `revalidatePath("/")`
   - `disableDemoMode()`: Call `setDbMode("real")`, `invalidateDbCache()`, `revalidatePath("/")`
   - `isDemoMode()`: Return `getDbMode() === "demo"`

6. **Enhance `src/actions/sync.actions.ts`:**
   - Add demo mode check at start of `triggerSync()`
   - Call `invalidateDbCache()` after sync
   - Call `revalidatePath("/")`, `revalidatePath("/transactions")`, `revalidatePath("/insights")`
   - Add `getSyncStatus()` function that returns `{ lastSyncAt, syncHistory, hasCredentials }`

### Phase C: UI Setup

7. **Install required shadcn components (if not already present):**
   ```bash
   npx shadcn@latest add alert-dialog
   npx shadcn@latest add tooltip
````

### Phase D: Context Provider

8. **Create `src/contexts/sync-context.tsx`:**
   - Create `SyncProvider` component
   - Manage state: `lastSyncAt`, `isSyncing`, `syncStatus`, `syncError`, `hasCredentials`
   - Implement `triggerManualSync()` that calls `triggerSync("dkb")`
   - Implement `refreshSyncStatus()` that calls `getSyncStatus()`
   - Export `useSync()` hook

### Phase E: UI Components

9. **Create `src/components/sync-button.tsx`:**
   - Use `useSync()` hook
   - Use `useDemoMode()` hook
   - Render RefreshCw icon with spinning animation when syncing
   - Show Check icon on success, AlertCircle on error
   - Disable when `isDemoMode` or `!hasCredentials`
   - Wrap with Tooltip for context

10. **Create `src/components/sync-status.tsx`:**
    - Use `useSync()` hook
    - Use `useDemoMode()` hook
    - Show "Demo data" in amber when in demo mode
    - Show "Syncing..." with pulse animation
    - Show "Synced X ago" using `formatDistanceToNow` from date-fns
    - Update every minute with `setInterval`

11. **Update `src/components/demo-toggle.tsx`:**
    - Add AlertDialog import
    - Add state for `showConfirm` and `pendingAction`
    - Show confirmation dialog on toggle
    - Explain that data is preserved
    - Handle confirm/cancel actions

### Phase F: Integration

12. **Update `src/components/layout/Header.tsx`:**
    - Import `SyncButton` and `SyncStatus`
    - Add `SyncStatus` before controls (desktop only with `hidden lg:flex`)
    - Add `SyncButton` before `DemoToggle`
    - Add vertical divider between SyncButton and DemoToggle
    - Add sync controls to mobile menu

13. **Update `src/app/layout.tsx`:**
    - Import `SyncProvider` from contexts
    - Wrap children with `<SyncProvider>` inside `<DemoProvider>`

### Phase G: Testing

14. **Manual test checklist:**
    - [ ] Click Sync button → shows spinner, then success
    - [ ] Enable demo mode with real data → real data preserved
    - [ ] Disable demo mode → real data restored
    - [ ] Last sync time displays correctly
    - [ ] Sync in demo mode → button disabled
    - [ ] Sync without credentials → button disabled
    - [ ] Error handling shows proper messages
    - [ ] Mobile menu shows sync controls

## Design Guidelines

Follow these Neo-Glass theme requirements:

- Glass effect: `bg-card/50 backdrop-blur-xl`
- Borders: `border-white/10 dark:border-white/5`
- Use `cn()` utility for conditional classes
- Use Motion transitions for state changes
- Sync button success: `text-green-500`
- Sync button error: `text-destructive`
- Demo mode: `text-amber-500`

## Success Criteria

- [ ] Users can trigger sync via header button
- [ ] Last sync time displays and updates correctly
- [ ] Demo mode toggle preserves real data
- [ ] UI refreshes immediately after sync
- [ ] Error states clearly communicated
- [ ] Mobile experience functional
- [ ] TypeScript strict mode passes
- [ ] ESLint passes
- [ ] Build succeeds

## Important Notes

- Do NOT merge demo and real data
- Real data file (`db.json`) must never be modified in demo mode
- Demo data file (`db-demo.json`) is independent
- Always call `invalidateDbCache()` after `db.write()`
- Always call `revalidatePath()` for affected routes

## After Implementation

Update `docs/PROJECT-STATE.md`:

- Mark Phase 6 tasks as complete
- Document any deviations from plan
- Note any new issues discovered

```

---

## Quick Start

Copy the prompt above and paste it to Claude Code to begin implementation.

## Expected Duration

- Phase A-B (Backend): ~30 minutes
- Phase C-E (UI Components): ~45 minutes
- Phase F (Integration): ~15 minutes
- Phase G (Testing): ~20 minutes

**Total: ~2 hours**
```
