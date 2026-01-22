/**
 * DemoDataDialog - Toggle between demo and real data
 * 
 * Allows users to load sample transactions for testing without DKB credentials
 * and switch back to real data anytime.
 */

import { useState } from 'react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { AlertCircle, CheckCircle2, Database, Sparkles } from 'lucide-react';
import { db } from '@/lib/db';
import {
  generateSampleAccount,
  generateSampleTransactions,
  generateDeutscheBankAccount,
  hasDemoData,
  isDemoAccount,
} from '@/lib/demo/sampleData';
import { categorizeTransactions } from '@/lib/categorizer';

export interface DemoDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

export function DemoDataDialog({ open, onOpenChange, onComplete }: DemoDataDialogProps) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [demoMode, setDemoMode] = useState<boolean | null>(null);

  // Check if demo data exists on dialog open
  useState(() => {
    if (open) {
      checkDemoMode();
    }
  });

  async function checkDemoMode() {
    const hasDemo = await hasDemoData(db);
    setDemoMode(hasDemo);
  }

  /**
   * Load demo data into IndexedDB
   */
  async function loadDemoData() {
    setLoading(true);
    setStatus('loading');
    setMessage('Loading sample data...');

    try {
      // Generate sample accounts
      const dkbAccount = generateSampleAccount();
      const dbAccount = generateDeutscheBankAccount();

      // Add accounts to database
      await db.accounts.put(dkbAccount);
      await db.accounts.put(dbAccount);

      // Generate transactions for DKB account
      const dkbTransactions = generateSampleTransactions(dkbAccount.id);
      const categorized = categorizeTransactions(dkbTransactions);

      // Add transactions to database
      await db.transactions.bulkPut(categorized);

      // Update account balances
      const dkbBalance = categorized
        .filter(t => t.accountId === dkbAccount.id)
        .reduce((sum, t) => sum + t.amount, 0);
      
      await db.accounts.update(dkbAccount.id, { balance: dkbBalance });

      setStatus('success');
      setMessage(`✅ Loaded ${categorized.length} sample transactions across 2 accounts`);
      setDemoMode(true);

      setTimeout(() => {
        onComplete?.();
        onOpenChange(false);
      }, 2000);
    } catch (error) {
      setStatus('error');
      setMessage(`❌ Error loading demo data: ${error}`);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Clear demo data and switch to real data mode
   */
  async function clearDemoData() {
    setLoading(true);
    setStatus('loading');
    setMessage('Clearing demo data...');

    try {
      // Get all demo accounts
      const allAccounts = await db.accounts.toArray();
      const demoAccounts = allAccounts.filter(acc => isDemoAccount(acc.id));

      // Delete demo accounts
      await Promise.all(
        demoAccounts.map(acc => db.accounts.delete(acc.id))
      );

      // Delete demo transactions
      const allTransactions = await db.transactions.toArray();
      const demoTransactions = allTransactions.filter(tx => 
        demoAccounts.some(acc => acc.id === tx.accountId)
      );

      await Promise.all(
        demoTransactions.map(tx => db.transactions.delete(tx.id))
      );

      setStatus('success');
      setMessage(`✅ Cleared ${demoTransactions.length} demo transactions and ${demoAccounts.length} demo accounts`);
      setDemoMode(false);

      setTimeout(() => {
        onComplete?.();
        onOpenChange(false);
      }, 2000);
    } catch (error) {
      setStatus('error');
      setMessage(`❌ Error clearing demo data: ${error}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" />
            Demo Data Manager
          </DialogTitle>
          <DialogDescription>
            {demoMode 
              ? 'Demo data is currently loaded. Switch back to your real data anytime.'
              : 'Load sample transactions to test the app without DKB credentials.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Mode Indicator */}
          <div className={`rounded-lg border p-4 ${demoMode ? 'bg-violet-50 border-violet-200 dark:bg-violet-950 dark:border-violet-800' : 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800'}`}>
            <div className="flex items-center gap-3">
              <Database className={`h-5 w-5 ${demoMode ? 'text-violet-600' : 'text-blue-600'}`} />
              <div>
                <p className="font-medium">
                  {demoMode ? 'Demo Mode Active' : 'Real Data Mode'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {demoMode 
                    ? 'Sample transactions loaded (2 accounts, ~100 transactions)'
                    : 'Using your actual synced transactions'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Demo Data Info */}
          {!demoMode && (
            <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
              <p className="text-sm font-medium">Demo data includes:</p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• DKB Girokonto with 90 days of transactions</li>
                <li>• Deutsche Bank account (for testing)</li>
                <li>• Realistic categories: groceries, restaurants, utilities, etc.</li>
                <li>• German merchant names (REWE, Edeka, Deutsche Bahn, etc.)</li>
                <li>• ~100 sample transactions across all categories</li>
              </ul>
            </div>
          )}

          {/* Status Messages */}
          {status !== 'idle' && (
            <div className={`flex items-start gap-2 rounded-lg border p-4 ${
              status === 'success' ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' :
              status === 'error' ? 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800' :
              'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800'
            }`}>
              {status === 'success' && <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />}
              {status === 'error' && <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />}
              {status === 'loading' && (
                <div className="h-5 w-5 mt-0.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              )}
              <p className="text-sm flex-1">{message}</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          
          {demoMode ? (
            <Button
              onClick={clearDemoData}
              disabled={loading}
              variant="default"
            >
              {loading ? 'Clearing...' : 'Switch to Real Data'}
            </Button>
          ) : (
            <Button
              onClick={loadDemoData}
              disabled={loading}
              variant="default"
              className="bg-violet-600 hover:bg-violet-700"
            >
              {loading ? 'Loading...' : 'Load Demo Data'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
