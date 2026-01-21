import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Layout, Header } from '@/components/layout'
import { TransactionTable } from '@/components/transactions'
import { SyncDialog } from '@/components/sync'
import { db } from '@/lib/db'

function App() {
  const [syncDialogOpen, setSyncDialogOpen] = useState(false)

  // Load all transactions from IndexedDB (live query)
  const transactions = useLiveQuery(
    () => db.transactions.orderBy('bookingDate').reverse().toArray(),
    []
  )

  // Load all accounts
  const accounts = useLiveQuery(
    () => db.accounts.toArray(),
    []
  )

  const handleSyncComplete = (transactionCount: number) => {
    console.log(`Synced ${transactionCount} transactions`)
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
        {/* Account Summary */}
        {accounts && accounts.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {accounts.map((account) => (
              <div 
                key={account.id} 
                className="rounded-lg border bg-card p-4"
              >
                <h3 className="font-semibold">{account.name}</h3>
                <p className="text-sm text-muted-foreground">{account.bank.toUpperCase()}</p>
                {account.iban && (
                  <p className="text-xs text-muted-foreground mt-1">{account.iban}</p>
                )}
                <p className="text-2xl font-bold mt-2">
                  €{(account.balance / 100).toFixed(2)}
                </p>
                {account.lastSynced && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Last synced: {new Date(account.lastSynced).toLocaleString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Transactions Table */}
        <TransactionTable transactions={transactions || []} />
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
