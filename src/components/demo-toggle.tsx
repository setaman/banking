"use client";

import * as React from "react";
import { FlaskConical } from "lucide-react";
import { useDemoMode } from "@/contexts/demo-context";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export function DemoToggle() {
  const { isDemoMode, enableDemo, disableDemo, isLoading } = useDemoMode();
  const [mounted, setMounted] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [pendingAction, setPendingAction] = React.useState<
    "enable" | "disable" | null
  >(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center gap-2">
        <FlaskConical className="text-muted-foreground h-4 w-4" />
        <Switch disabled size="sm" />
      </div>
    );
  }

  const handleToggleRequest = (checked: boolean) => {
    setPendingAction(checked ? "enable" : "disable");
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    if (pendingAction === "enable") {
      await enableDemo();
    } else {
      await disableDemo();
    }
    setShowConfirm(false);
    setPendingAction(null);
  };

  const handleCancel = () => {
    setShowConfirm(false);
    setPendingAction(null);
  };

  return (
    <>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <FlaskConical
            className={cn(
              "h-4 w-4 transition-colors",
              isDemoMode ? "text-amber-500" : "text-muted-foreground"
            )}
          />
          <Switch
            checked={isDemoMode}
            onCheckedChange={handleToggleRequest}
            disabled={isLoading}
            size="sm"
            className={cn(
              isDemoMode &&
                "data-[state=checked]:bg-amber-500 dark:data-[state=checked]:bg-amber-500"
            )}
            aria-label="Toggle demo mode"
          />
        </div>
        {isDemoMode && (
          <Badge
            variant="outline"
            className={cn(
              "border-amber-500/30 bg-amber-500/10 text-amber-600 backdrop-blur-sm",
              "dark:border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-400",
              "shadow-sm shadow-amber-500/20"
            )}
          >
            Demo Mode
          </Badge>
        )}
      </div>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction === "enable"
                ? "Enable Demo Mode?"
                : "Disable Demo Mode?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction === "enable"
                ? "This will switch to sample data. Your real banking data will be preserved and restored when you disable demo mode."
                : "This will switch back to your real banking data. Demo data will be preserved for later."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              {pendingAction === "enable" ? "Enable Demo" : "Show Real Data"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
