/**
 * Export Dialog Component
 * 
 * Provides functionality to export all finance data (accounts, transactions, categories)
 * as a JSON backup file. Users can download the file for backup purposes or data portability.
 */

import { useState } from 'react';
import { Download, CheckCircle, FileJson } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getAllAccounts, getTransactionsByAccount } from '@/lib/db';
import type { Account, Transaction } from '@/types';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ExportData {
  version: string;
  exportDate: string;
  accounts: Account[];
  transactions: Transaction[];
}

export function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  /**
   * Formats date for filename (YYYY-MM-DD-HHmmss)
   */
  const getTimestampedFilename = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `finance-dashboard-backup-${year}-${month}-${day}-${hours}${minutes}${seconds}.json`;
  };

  /**
   * Creates a download link and triggers download
   */
  const downloadJSON = (data: ExportData, filename: string) => {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();

    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /**
   * Handles export operation
   */
  const handleExport = async () => {
    setIsExporting(true);
    setError(null);
    setSuccess(null);

    try {
      // Fetch all accounts
      const accounts = await getAllAccounts();

      if (accounts.length === 0) {
        setError('No data to export. Please sync or import transactions first.');
        setIsExporting(false);
        return;
      }

      // Fetch all transactions for all accounts
      const allTransactions: Transaction[] = [];
      
      for (const account of accounts) {
        const transactions = await getTransactionsByAccount(account.id);
        allTransactions.push(...transactions);
      }

      // Prepare export data
      const exportData: ExportData = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        accounts: accounts,
        transactions: allTransactions,
      };

      // Generate filename with timestamp
      const filename = getTimestampedFilename();

      // Trigger download
      downloadJSON(exportData, filename);

      // Show success message
      setSuccess(
        `Exported ${accounts.length} account${accounts.length !== 1 ? 's' : ''} ` +
        `and ${allTransactions.length} transaction${allTransactions.length !== 1 ? 's' : ''}`
      );
      setIsExporting(false);

      // Close dialog after 2 seconds
      setTimeout(() => {
        onOpenChange(false);
        setSuccess(null);
      }, 2000);

    } catch (err) {
      setIsExporting(false);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred during export');
      }
    }
  };

  /**
   * Handles dialog close
   */
  const handleClose = (open: boolean) => {
    if (!isExporting) {
      if (!open) {
        setError(null);
        setSuccess(null);
      }
      onOpenChange(open);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Export Data</DialogTitle>
          <DialogDescription>
            Download all your accounts and transactions as a JSON backup file.
            You can use this file for backup or data portability.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/50">
            <FileJson className="h-12 w-12 text-primary" />
            <div className="flex-1">
              <h4 className="text-sm font-medium">JSON Backup File</h4>
              <p className="text-xs text-muted-foreground">
                Includes all accounts, transactions, and metadata
              </p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mt-4 rounded-md bg-green-500/15 p-3 text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              {success}
            </div>
          )}

          <div className="mt-4 space-y-2 text-xs text-muted-foreground">
            <p>• File will be saved with timestamp for easy organization</p>
            <p>• All data is exported in JSON format</p>
            <p>• You can import this file later to restore your data</p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={isExporting}
          >
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <>
                <Download className="mr-2 h-4 w-4 animate-pulse" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export Data
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
