/**
 * CSV Import Component
 * 
 * Provides drag-and-drop and file upload functionality for importing
 * transactions from CSV files. Supports bank selection, account selection,
 * preview, and progress indication.
 */

import { useState, useRef } from 'react';
// @ts-ignore - PapaParse types will be available after npm install
import Papa from 'papaparse';
import { Upload, X, FileText, CheckCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { parseCSV, type CSVRow } from '@/lib/parsers';
import { upsertTransactions } from '@/lib/db';
import { useAccountsStore } from '@/store/accounts.store';
import type { BankType } from '@/types';

interface CsvImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: (transactionCount: number) => void;
}

export function CsvImport({ open, onOpenChange, onImportComplete }: CsvImportProps) {
  const { accounts } = useAccountsStore();
  
  // Form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [bankType, setBankType] = useState<BankType>('deutsche-bank');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [previewData, setPreviewData] = useState<CSVRow[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Resets form to initial state
   */
  const resetForm = () => {
    setSelectedFile(null);
    setPreviewData([]);
    setError(null);
    setSuccess(null);
    setBankType('deutsche-bank');
    setSelectedAccountId('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * Handles file selection and preview
   */
  const handleFileSelect = (file: File) => {
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      setError('Please select a CSV file');
      return;
    }

    setSelectedFile(file);
    setError(null);
    setSuccess(null);

    // Parse CSV and show preview (first 5 rows)
    Papa.parse<CSVRow>(file, {
      header: true,
      preview: 5,
      skipEmptyLines: true,
      complete: (results: any) => {
        if (results.errors.length > 0) {
          setError(`CSV parsing error: ${results.errors[0].message}`);
          return;
        }
        setPreviewData(results.data);
      },
      error: (error: any) => {
        setError(`Failed to parse CSV: ${error.message}`);
      },
    });
  };

  /**
   * Handles file input change
   */
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  /**
   * Handles drag and drop
   */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  /**
   * Handles import operation
   */
  const handleImport = async () => {
    // Validate inputs
    if (!selectedFile) {
      setError('Please select a CSV file');
      return;
    }

    if (!selectedAccountId) {
      setError('Please select an account');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Parse entire CSV file
      Papa.parse<CSVRow>(selectedFile, {
        header: true,
        skipEmptyLines: true,
        complete: async (results: any) => {
          try {
            if (results.errors.length > 0) {
              throw new Error(`CSV parsing error: ${results.errors[0].message}`);
            }

            if (results.data.length === 0) {
              throw new Error('CSV file is empty');
            }

            // Parse transactions using appropriate bank parser
            const transactions = await parseCSV(
              results.data,
              bankType,
              selectedAccountId
            );

            if (transactions.length === 0) {
              setSuccess('No valid transactions found in CSV file');
              setIsLoading(false);
              return;
            }

            // Save to IndexedDB
            await upsertTransactions(transactions);

            // Update account balance
            const accountStore = useAccountsStore.getState();
            await accountStore.updateAccountBalance(selectedAccountId);

            // Show success message
            setSuccess(
              `Successfully imported ${transactions.length} transaction${
                transactions.length !== 1 ? 's' : ''
              }`
            );
            setIsLoading(false);

            // Notify parent component
            setTimeout(() => {
              onImportComplete?.(transactions.length);
              resetForm();
              onOpenChange(false);
            }, 1500);
          } catch (err) {
            setIsLoading(false);
            if (err instanceof Error) {
              setError(err.message);
            } else {
              setError('An unexpected error occurred during import');
            }
          }
        },
        error: (error: any) => {
          setIsLoading(false);
          setError(`Failed to parse CSV: ${error.message}`);
        },
      });
    } catch (err) {
      setIsLoading(false);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred');
      }
    }
  };

  /**
   * Handles dialog close
   */
  const handleClose = (open: boolean) => {
    if (!isLoading) {
      if (!open) {
        resetForm();
      }
      onOpenChange(open);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Transactions from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file from your bank to import transactions.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Bank Selector */}
          <div className="grid gap-2">
            <label htmlFor="bankType" className="text-sm font-medium">
              Bank Type
            </label>
            <select
              id="bankType"
              value={bankType}
              onChange={(e) => setBankType(e.target.value as BankType)}
              disabled={isLoading}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="deutsche-bank">Deutsche Bank CSV</option>
              <option value="dkb" disabled>
                DKB (Use API Sync instead)
              </option>
            </select>
            <p className="text-xs text-muted-foreground">
              Select your bank's CSV format
            </p>
          </div>

          {/* Account Selector */}
          <div className="grid gap-2">
            <label htmlFor="account" className="text-sm font-medium">
              Import to Account
            </label>
            <select
              id="account"
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              disabled={isLoading || accounts.length === 0}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Select an account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.bank})
                </option>
              ))}
            </select>
            {accounts.length === 0 && (
              <p className="text-xs text-destructive">
                No accounts found. Please sync DKB or create an account first.
              </p>
            )}
          </div>

          {/* File Upload Area */}
          <div className="grid gap-2">
            <label className="text-sm font-medium">CSV File</label>
            <div
              className={`
                relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
                transition-colors
                ${isDragging ? 'border-primary bg-primary/5' : 'border-border'}
                ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary'}
              `}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !isLoading && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileInputChange}
                disabled={isLoading}
                className="hidden"
              />

              {selectedFile ? (
                <div className="flex items-center justify-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium">{selectedFile.name}</span>
                  {!isLoading && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        resetForm();
                      }}
                      className="ml-2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Drag and drop CSV file here, or click to browse
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Preview */}
          {previewData.length > 0 && (
            <div className="grid gap-2">
              <label className="text-sm font-medium">Preview (first 5 rows)</label>
              <div className="border rounded-md overflow-hidden">
                <div className="overflow-x-auto max-h-48">
                  <table className="w-full text-xs">
                    <thead className="bg-muted">
                      <tr>
                        {Object.keys(previewData[0]).map((header) => (
                          <th key={header} className="px-2 py-1 text-left font-medium">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((row, idx) => (
                        <tr key={idx} className="border-t">
                          {Object.values(row).map((cell, cellIdx) => (
                            <td key={cellIdx} className="px-2 py-1">
                              {String(cell).substring(0, 30)}
                              {String(cell).length > 30 ? '...' : ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="rounded-md bg-green-500/15 p-3 text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              {success}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={isLoading || !selectedFile || !selectedAccountId}>
            {isLoading ? 'Importing...' : 'Import Transactions'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
