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
  
  // Form state - credentials ONLY stored during sync operation
  const [cookie, setCookie] = useState('');
  const [xsrfToken, setXsrfToken] = useState('');
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
    setCookie(''); // CRITICAL: Clear cookie from memory
    setXsrfToken(''); // CRITICAL: Clear XSRF token from memory
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
    if (!cookie.trim()) {
      setError('Cookie header is required');
      return;
    }

    if (!xsrfToken.trim()) {
      setError('XSRF token is required');
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
      const apiResponse = await fetchAllTransactions({
        cookie,
        xsrfToken,
      }, {
        accountId,
        fromDate,
        toDate,
      });

      // CRITICAL: Clear credentials immediately after API call
      const transactionData = apiResponse.data;
      setCookie(''); // Cookie no longer needed
      setXsrfToken(''); // XSRF token no longer needed

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
      // CRITICAL: Clear credentials even on error
      setCookie('');
      setXsrfToken('');
      
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
            Copy the cookie and x-xsrf-token headers from your DKB browser session.
            These are never stored or logged.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Cookie Header Input */}
          <div className="grid gap-2">
            <label htmlFor="cookie" className="text-sm font-medium">
              Cookie Header
            </label>
            <Input
              id="cookie"
              type="password"
              placeholder="Paste cookie header from DevTools"
              value={cookie}
              onChange={(e) => setCookie(e.target.value)}
              disabled={isLoading}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Copy from DevTools → Network → Request Headers → cookie
            </p>
          </div>

          {/* XSRF Token Input */}
          <div className="grid gap-2">
            <label htmlFor="xsrfToken" className="text-sm font-medium">
              XSRF Token
            </label>
            <Input
              id="xsrfToken"
              type="password"
              placeholder="e.g., 8efaa917-0d1d-4b7e-901b-6e6bfa0d0ec8"
              value={xsrfToken}
              onChange={(e) => setXsrfToken(e.target.value)}
              disabled={isLoading}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Copy from DevTools → Network → Request Headers → x-xsrf-token
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
