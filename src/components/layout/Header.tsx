import { Button } from '@/components/ui/button';
import { ThemeToggle } from './ThemeToggle';

interface HeaderProps {
  onSyncClick: () => void;
  isSyncing?: boolean;
}

export function Header({ onSyncClick, isSyncing = false }: HeaderProps) {
  return (
    <header className="border-b bg-background">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Finance Dashboard</h1>
          <span className="text-sm text-muted-foreground">DKB Banking</span>
        </div>
        
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button 
            onClick={onSyncClick} 
            disabled={isSyncing}
            variant="default"
          >
            {isSyncing ? 'Syncing...' : 'Sync Transactions'}
          </Button>
        </div>
      </div>
    </header>
  );
}
