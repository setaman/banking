/**
 * AccountSelector Component
 * 
 * Dropdown/select component for choosing accounts or viewing all accounts combined.
 * Displays account name, bank, last 4 IBAN digits, and current balance.
 * Responsive design with mobile-friendly layout.
 */

import { useState } from 'react';
import { useAccounts } from '@/hooks/useAccounts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Wallet, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AccountSelectorProps {
  /** Selected account ID (or 'all' for combined view) */
  value?: string;
  
  /** Callback when account selection changes */
  onValueChange?: (accountId: string) => void;
  
  /** Show balance in the selector */
  showBalance?: boolean;
  
  /** Additional CSS class names */
  className?: string;
}

/**
 * Format account balance in EUR
 */
function formatBalance(amountInCents: number): string {
  const euros = amountInCents / 100;
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(euros);
}

/**
 * Get last 4 digits of IBAN for display
 */
function getLastFourIban(iban?: string): string {
  if (!iban) return '****';
  return iban.slice(-4);
}

/**
 * Get bank display name
 */
function getBankName(bank: string): string {
  const bankNames: Record<string, string> = {
    'dkb': 'DKB',
    'deutsche-bank': 'Deutsche Bank',
    'other': 'Other',
  };
  return bankNames[bank] || bank;
}

export function AccountSelector({
  value = 'all',
  onValueChange,
  showBalance = true,
  className,
}: AccountSelectorProps) {
  const { accounts, isLoading } = useAccounts();
  const [selectedAccountId, setSelectedAccountId] = useState(value);

  // Calculate combined balance for "All Accounts" option
  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);

  // Get selected account for balance display
  const selectedAccount = selectedAccountId === 'all' 
    ? null 
    : accounts.find(acc => acc.id === selectedAccountId);

  const displayBalance = selectedAccountId === 'all' 
    ? totalBalance 
    : selectedAccount?.balance ?? 0;

  const handleValueChange = (newValue: string) => {
    setSelectedAccountId(newValue);
    onValueChange?.(newValue);
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Wallet className="h-4 w-4 animate-pulse" />
            <span>Loading accounts...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Account Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Select Account
            </label>
            <Select value={selectedAccountId} onValueChange={handleValueChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select an account" />
              </SelectTrigger>
              <SelectContent>
                {/* All Accounts Option */}
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4" />
                    <span className="font-medium">All Accounts</span>
                  </div>
                </SelectItem>

                {/* Individual Accounts */}
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      <div className="flex flex-col">
                        <span className="font-medium">{account.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {getBankName(account.bank)} • ****{getLastFourIban(account.iban)}
                        </span>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Balance Display */}
          {showBalance && (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Current Balance</p>
              <p
                className={cn(
                  'text-3xl font-bold tabular-nums sm:text-4xl',
                  displayBalance >= 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                )}
              >
                {formatBalance(displayBalance)}
              </p>
              
              {/* Account Info */}
              {selectedAccountId === 'all' ? (
                <p className="text-sm text-muted-foreground">
                  Combined from {accounts.length} account{accounts.length !== 1 ? 's' : ''}
                </p>
              ) : selectedAccount && (
                <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" />
                    <span>{getBankName(selectedAccount.bank)}</span>
                  </div>
                  {selectedAccount.iban && (
                    <div className="font-mono text-xs">
                      {selectedAccount.iban}
                    </div>
                  )}
                  {selectedAccount.lastSynced && (
                    <div className="text-xs">
                      Last synced: {new Intl.DateTimeFormat('en-US', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(selectedAccount.lastSynced)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Empty State */}
          {accounts.length === 0 && (
            <div className="rounded-lg border border-dashed p-4 text-center">
              <Wallet className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">No accounts found</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Add an account to get started
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
