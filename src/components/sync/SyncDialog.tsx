import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { fetchAllTransactions } from '@/lib/api/dkb';
import { parseDKBTransactions } from '@/lib/parsers/dkb.parser';
import { upsertTransactions, upsertAccount } from '@/lib/db';
import type { Account } from '@/types';

interface SyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSyncComplete: (transactionCount: number) => void;
}

/**
 * Formats date to YYYY-MM-DD format for API
 */
function formatDateForApi(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Gets default date range (last 90 days)
 */
function getDefaultDateRange(): { fromDate: string; toDate: string } {
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 90);

  return {
    fromDate: formatDateForApi(fromDate),
    toDate: formatDateForApi(toDate),
  };
}

export function SyncDialog({ open, onOpenChange, onSyncComplete }: SyncDialogProps) {
  const defaultDates = getDefaultDateRange();
  
  // Form state - token is ONLY stored during sync operation
  const [bearerToken, setBearerToken] = useState('');
  const [accountId, setAccountId] = useState('');
  const [fromDate, setFromDate] = useState(defaultDates.fromDate);
  const [toDate, setToDate] = useState(defaultDates.toDate);
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  /**
   * Clears all sensitive form data
   */
  const clearSensitiveData = () => {
    setBearerToken(''); // CRITICAL: Clear token from memory
    setError(null);
    setSuccess(null);
  };

  /**
   * Resets form to initial state
   */
  const resetForm = () => {
    clearSensitiveData();
    setAccountId('');
    const defaults = getDefaultDateRange();
    setFromDate(defaults.fromDate);
    setToDate(defaults.toDate);
  };

  /**
   * Handles sync operation
   */
  const handleSync = async () => {
    // Validate inputs
    if (!bearerToken.trim()) {
      setError('Bearer token is required');
      return;
    }

    if (!accountId.trim()) {
      setError('Account ID is required');
      return;
    }

    if (!fromDate || !toDate) {
      setError('Date range is required');
      return;
    }

    if (new Date(fromDate) > new Date(toDate)) {
      setError('From date must be before to date');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Fetch transactions from DKB API
      const apiResponse = await fetchAllTransactions(bearerToken, {
        accountId,
        fromDate,
        toDate,
      });

      // CRITICAL: Clear token immediately after API call
      const transactionData = apiResponse.data;
      setBearerToken(''); // Token no longer needed

      // Parse transactions
      const transactions = parseDKBTransactions(transactionData, accountId);

      if (transactions.length === 0) {
        setSuccess('Sync completed successfully, but no transactions found for this date range.');
        setIsLoading(false);
        return;
      }

      // Create or update account record
      const account: Account = {
        id: accountId,
        name: `DKB Account ${accountId}`,
        bank: 'dkb',
        balance: 0, // Balance will be calculated from transactions
        currency: 'EUR',
        lastSynced: new Date(),
        createdAt: new Date(),
      };

      // Save to IndexedDB
      await upsertAccount(account);
      await upsertTransactions(transactions);

      // Show success message
      setSuccess(`Successfully synced ${transactions.length} transaction${transactions.length !== 1 ? 's' : ''}`);
      setIsLoading(false);

      // Notify parent component
      setTimeout(() => {
        onSyncComplete(transactions.length);
        resetForm();
        onOpenChange(false);
      }, 1500);

    } catch (err) {
      // CRITICAL: Clear token even on error
      setBearerToken('');
      
      setIsLoading(false);
      
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred during sync');
      }
    }
  };

  /**
   * Handles dialog close
   */
  const handleClose = (open: boolean) => {
    if (!isLoading) {
      if (!open) {
        clearSensitiveData(); // Clear token when dialog closes
      }
      onOpenChange(open);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Sync DKB Transactions</DialogTitle>
          <DialogDescription>
            Enter your DKB bearer token and account details to sync transactions.
            Your token is never stored or logged.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Bearer Token Input */}
          <div className="grid gap-2">
            <label htmlFor="bearerToken" className="text-sm font-medium">
              Bearer Token
            </label>
            <Input
              id="bearerToken"
              type="password"
              placeholder="Enter your DKB bearer token"
              value={bearerToken}
              onChange={(e) => setBearerToken(e.target.value)}
              disabled={isLoading}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Token is cleared from memory immediately after sync
            </p>
          </div>

          {/* Account ID Input */}
          <div className="grid gap-2">
            <label htmlFor="accountId" className="text-sm font-medium">
              Account ID
            </label>
            <Input
              id="accountId"
              type="text"
              placeholder="e.g., 1059960000"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              disabled={isLoading}
            />
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <label htmlFor="fromDate" className="text-sm font-medium">
                From Date
              </label>
              <Input
                id="fromDate"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="toDate" className="text-sm font-medium">
                To Date
              </label>
              <Input
                id="toDate"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="rounded-md bg-green-500/15 p-3 text-sm text-green-600 dark:text-green-400">
              {success}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button onClick={handleSync} disabled={isLoading}>
            {isLoading ? 'Syncing...' : 'Sync Transactions'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
