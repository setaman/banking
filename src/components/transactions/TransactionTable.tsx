import { Transaction } from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface TransactionTableProps {
  transactions: Transaction[];
}

/**
 * Formats amount from cents to EUR with currency symbol
 * @param amountInCents - Amount in cents (e.g., -711 = -€7.11)
 * @returns Formatted string (e.g., "€7.11")
 */
function formatAmount(amountInCents: number): string {
  const euros = Math.abs(amountInCents) / 100;
  return `€${euros.toFixed(2)}`;
}

/**
 * Formats date to readable format
 * @param date - Date object
 * @returns Formatted date string (e.g., "Dec 30, 2025")
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

/**
 * Gets CSS class for amount based on positive/negative
 */
function getAmountClassName(amount: number): string {
  if (amount < 0) return 'text-red-600 dark:text-red-400';
  if (amount > 0) return 'text-green-600 dark:text-green-400';
  return 'text-muted-foreground';
}

/**
 * Formats category for display (capitalizes first letter)
 */
function formatCategory(category?: string): string {
  if (!category) return 'Uncategorized';
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export function TransactionTable({ transactions }: TransactionTableProps) {
  // Sort transactions by booking date (newest first)
  const sortedTransactions = [...transactions].sort(
    (a, b) => b.bookingDate.getTime() - a.bookingDate.getTime()
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transactions</CardTitle>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-lg font-medium text-muted-foreground">
              No transactions found
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Click &quot;Sync Transactions&quot; to import your DKB transactions
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[120px]">Category</TableHead>
                  <TableHead className="w-[120px] text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedTransactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-medium">
                      {formatDate(transaction.bookingDate)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{transaction.description}</span>
                        {transaction.counterpartyName && (
                          <span className="text-sm text-muted-foreground">
                            {transaction.counterpartyName}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold">
                        {formatCategory(transaction.category)}
                      </span>
                    </TableCell>
                    <TableCell
                      className={cn('text-right font-mono font-semibold', getAmountClassName(transaction.amount))}
                    >
                      {transaction.amount < 0 ? '-' : '+'}
                      {formatAmount(transaction.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        
        {transactions.length > 0 && (
          <div className="mt-4 text-sm text-muted-foreground">
            Showing {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
