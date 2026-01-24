"use client";

import * as React from "react";
import { FlaskConical } from "lucide-react";
import { useDemoMode } from "@/contexts/demo-context";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function DemoToggle() {
  const { isDemoMode, enableDemo, disableDemo, isLoading } = useDemoMode();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center gap-2">
        <FlaskConical className="h-4 w-4 text-muted-foreground" />
        <Switch disabled size="sm" />
      </div>
    );
  }

  const handleToggle = async (checked: boolean) => {
    if (checked) {
      await enableDemo();
    } else {
      await disableDemo();
    }
  };

  return (
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
          onCheckedChange={handleToggle}
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
  );
}
