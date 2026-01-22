/**
 * BalanceCard Component
 * 
 * Card displaying account balance with visual indicators:
 * - Large, prominent balance text
 * - Color-coded (green for positive, red for negative)
 * - Account name and bank icon
 * - Last sync time
 * - Trend indicator with percentage change
 */

import { useEffect, useState } from 'react';
import { useAccounts } from '@/hooks/useAccounts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTransactionsByAccount } from '@/lib/db';
import { calculateBalance } from '@/lib/statistics';

export interface BalanceCardProps {
  /** Account ID to display (or 'all' for combined view) */
  accountId?: string;
  
  /** Additional CSS class names */
  className?: string;
  
  /** Show trend indicator */
  showTrend?: boolean;
}

/**
 * Format balance in EUR
 */
function formatBalance(amountInCents: number): string {
  const euros = Math.abs(amountInCents) / 100;
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(euros);
}

/**
 * Get bank icon/name
 */
function getBankName(bank: string): string {
  const bankNames: Record<string, string> = {
    'dkb': 'DKB',
    'deutsche-bank': 'Deutsche Bank',
    'other': 'Other Bank',
  };
  return bankNames[bank] || bank;
}

/**
 * Calculate balance trend (percentage change over last 30 days)
 */
async function calculateBalanceTrend(accountId: string): Promise<number> {
  try {
    const transactions = await getTransactionsByAccount(accountId);
    
    // Get transactions from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentTransactions = transactions.filter(
      tx => tx.bookingDate >= thirtyDaysAgo
    );
    
    if (recentTransactions.length === 0) {
      return 0;
    }
    
    // Calculate current balance and balance 30 days ago
    const currentBalance = calculateBalance(transactions);
    const balanceChange = calculateBalance(recentTransactions);
    const previousBalance = currentBalance - balanceChange;
    
    // Avoid division by zero
    if (previousBalance === 0) {
      return balanceChange > 0 ? 100 : -100;
    }
    
    // Calculate percentage change
    const percentageChange = (balanceChange / Math.abs(previousBalance)) * 100;
    return percentageChange;
  } catch (error) {
    console.error('Error calculating balance trend:', error);
    return 0;
  }
}

export function BalanceCard({
  accountId = 'all',
  className,
  showTrend = true,
}: BalanceCardProps) {
  const { accounts, isLoading } = useAccounts();
  const [trend, setTrend] = useState<number>(0);
  const [trendLoading, setTrendLoading] = useState(false);

  // Get account data
  const account = accountId === 'all' 
    ? null 
    : accounts.find(acc => acc.id === accountId);

  // Calculate combined balance for "All Accounts"
  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
  const displayBalance = accountId === 'all' ? totalBalance : account?.balance ?? 0;
  
  const accountName = accountId === 'all' 
    ? 'All Accounts' 
    : account?.name ?? 'Unknown Account';
    
  const bankName = account ? getBankName(account.bank) : 'Combined';

  // Load trend data
  useEffect(() => {
    if (accountId === 'all' || !showTrend) {
      setTrend(0);
      return;
    }

    setTrendLoading(true);
    calculateBalanceTrend(accountId)
      .then(setTrend)
      .finally(() => setTrendLoading(false));
  }, [accountId, showTrend]);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Wallet className="h-4 w-4 animate-pulse" />
            <span>Loading...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isPositive = displayBalance >= 0;
  const balanceColor = isPositive
    ? 'text-green-600 dark:text-green-400'
    : 'text-red-600 dark:text-red-400';

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {accountName}
          </CardTitle>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Building2 className="h-4 w-4" />
            <span>{bankName}</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-3">
          {/* Balance Display */}
          <div>
            <p className="text-sm text-muted-foreground mb-1">Current Balance</p>
            <p className={cn('text-4xl font-bold tabular-nums sm:text-5xl', balanceColor)}>
              {isPositive ? '' : '-'}
              {formatBalance(displayBalance)}
            </p>
          </div>

          {/* Trend Indicator */}
          {showTrend && accountId !== 'all' && !trendLoading && (
            <div className="flex items-center gap-2">
              {trend > 0 ? (
                <>
                  <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium text-green-600 dark:text-green-400">
                    +{trend.toFixed(1)}% this month
                  </span>
                </>
              ) : trend < 0 ? (
                <>
                  <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <span className="text-sm font-medium text-red-600 dark:text-red-400">
                    {trend.toFixed(1)}% this month
                  </span>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">No change this month</span>
              )}
            </div>
          )}

          {/* Last Synced */}
          {account?.lastSynced && (
            <p className="text-xs text-muted-foreground">
              Last synced: {new Intl.DateTimeFormat('en-US', {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(account.lastSynced)}
            </p>
          )}

          {/* All Accounts Info */}
          {accountId === 'all' && (
            <p className="text-xs text-muted-foreground">
              Combined from {accounts.length} account{accounts.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
