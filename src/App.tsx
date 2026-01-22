import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Layout, Header } from '@/components/layout'
import { TransactionTable } from '@/components/transactions'
import { TransactionFilters } from '@/components/transactions/TransactionFilters'
import { SyncDialog } from '@/components/sync'
import { 
  AccountSelector, 
  BalanceCard, 
  BalanceChart, 
  IncomeExpenseChart,
  CategoryPieChart
} from '@/components/dashboard'
import { db } from '@/lib/db'
import { applyTransactionFilters, createDefaultFilters } from '@/lib/filters'
import { categorizeTransactions } from '@/lib/categorizer'
import { initializeTheme } from '@/store/theme.store'
import type { TransactionFilters as FilterType } from '@/lib/filters'

function App() {
  const [syncDialogOpen, setSyncDialogOpen] = useState(false)
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all')
  const [filters, setFilters] = useState<FilterType>(createDefaultFilters())

  // Initialize theme on mount
  useEffect(() => {
    const cleanup = initializeTheme();
    return cleanup;
  }, []);

  // Load all transactions from IndexedDB (live query)
  const allTransactions = useLiveQuery(
    () => db.transactions.orderBy('bookingDate').reverse().toArray(),
    []
  )

  // Load all accounts (used indirectly by account store)
  useLiveQuery(
    () => db.accounts.toArray(),
    []
  )

  // Filter transactions by selected account
  const accountTransactions = allTransactions?.filter(t => 
    selectedAccountId === 'all' || t.accountId === selectedAccountId
  ) || []

  // Apply filters
  const filteredTransactions = applyTransactionFilters(accountTransactions, filters)

  // Auto-categorize transactions that don't have a category
  useEffect(() => {
    if (allTransactions && allTransactions.length > 0) {
      const uncategorized = allTransactions.filter(t => !t.category)
      if (uncategorized.length > 0) {
        const categorized = categorizeTransactions(uncategorized)
        // Update in database
        categorized.forEach(async (t) => {
          await db.transactions.update(t.id, { category: t.category })
        })
      }
    }
  }, [allTransactions])

  const handleSyncComplete = () => {
    setSyncDialogOpen(false)
  }

  return (
    <Layout
      header={
        <Header 
          onSyncClick={() => setSyncDialogOpen(true)}
        />
      }
    >
      <div className="space-y-6">
        {/* Account Selector */}
        <AccountSelector 
          value={selectedAccountId}
          onValueChange={setSelectedAccountId}
          showBalance={true}
        />

        {/* Dashboard Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          <BalanceCard accountId={selectedAccountId} showTrend={true} />
          <IncomeExpenseChart accountId={selectedAccountId} defaultPeriod="month" />
        </div>

        {/* Charts Row */}
        <div className="grid gap-6 md:grid-cols-2">
          <BalanceChart accountId={selectedAccountId} defaultPeriod={30} />
          <CategoryPieChart transactions={accountTransactions} />
        </div>

        {/* Transaction Filters */}
        <TransactionFilters filters={filters} onChange={setFilters} />

        {/* Transactions Table */}
        <TransactionTable transactions={filteredTransactions} />
      </div>

      {/* Sync Dialog */}
      <SyncDialog 
        open={syncDialogOpen}
        onOpenChange={setSyncDialogOpen}
        onSyncComplete={handleSyncComplete}
      />
    </Layout>
  )
}

export default App
