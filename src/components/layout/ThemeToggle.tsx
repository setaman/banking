/**
 * Theme Toggle Component
 * 
 * Provides a dropdown menu to toggle between light, dark, and system theme modes.
 * Displays sun/moon icons and persists the selection to localStorage.
 */

import { Sun, Moon, Monitor } from 'lucide-react';
import { useThemeStore } from '@/store/theme.store';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useState } from 'react';

export function ThemeToggle() {
  const { mode, effectiveTheme, setMode } = useThemeStore();
  const [isOpen, setIsOpen] = useState(false);

  /**
   * Gets the icon for current effective theme
   */
  const getThemeIcon = () => {
    if (effectiveTheme === 'dark') {
      return <Moon className="h-5 w-5" />;
    }
    return <Sun className="h-5 w-5" />;
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(true)}
        title="Toggle theme"
        className="relative"
      >
        {getThemeIcon()}
        <span className="sr-only">Toggle theme</span>
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[300px]">
          <DialogHeader>
            <DialogTitle>Theme</DialogTitle>
            <DialogDescription>
              Choose your preferred theme mode
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 py-4">
            {/* Light Mode */}
            <button
              onClick={() => {
                setMode('light');
                setIsOpen(false);
              }}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors
                ${
                  mode === 'light'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-muted'
                }
              `}
            >
              <Sun className="h-5 w-5" />
              <div className="flex-1 text-left">
                <div className="font-medium">Light</div>
                <div className="text-xs text-muted-foreground">
                  Always use light mode
                </div>
              </div>
            </button>

            {/* Dark Mode */}
            <button
              onClick={() => {
                setMode('dark');
                setIsOpen(false);
              }}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors
                ${
                  mode === 'dark'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-muted'
                }
              `}
            >
              <Moon className="h-5 w-5" />
              <div className="flex-1 text-left">
                <div className="font-medium">Dark</div>
                <div className="text-xs text-muted-foreground">
                  Always use dark mode
                </div>
              </div>
            </button>

            {/* System Mode */}
            <button
              onClick={() => {
                setMode('system');
                setIsOpen(false);
              }}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors
                ${
                  mode === 'system'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-muted'
                }
              `}
            >
              <Monitor className="h-5 w-5" />
              <div className="flex-1 text-left">
                <div className="font-medium">System</div>
                <div className="text-xs text-muted-foreground">
                  Use system preference
                </div>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
