"use client";

import * as React from "react";
import { enableDemoMode, disableDemoMode, isDemoMode } from "@/actions/demo.actions";

interface DemoContextValue {
  isDemoMode: boolean;
  enableDemo: () => Promise<void>;
  disableDemo: () => Promise<void>;
  isLoading: boolean;
}

const DemoContext = React.createContext<DemoContextValue | undefined>(undefined);

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [isDemoModeActive, setIsDemoModeActive] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  // Initialize from localStorage on mount
  React.useEffect(() => {
    setMounted(true);
    const storedMode = localStorage.getItem("demo-mode");
    if (storedMode !== null) {
      setIsDemoModeActive(storedMode === "true");
    }
  }, []);

  // Sync with server state on mount
  React.useEffect(() => {
    if (mounted) {
      isDemoMode().then((serverMode) => {
        const localMode = localStorage.getItem("demo-mode") === "true";
        // If they don't match, prefer server state
        if (serverMode !== localMode) {
          setIsDemoModeActive(serverMode);
          localStorage.setItem("demo-mode", String(serverMode));
        }
      });
    }
  }, [mounted]);

  const enableDemo = React.useCallback(async () => {
    setIsLoading(true);
    try {
      await enableDemoMode();
      setIsDemoModeActive(true);
      localStorage.setItem("demo-mode", "true");
    } catch (error) {
      console.error("Failed to enable demo mode:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const disableDemo = React.useCallback(async () => {
    setIsLoading(true);
    try {
      await disableDemoMode();
      setIsDemoModeActive(false);
      localStorage.setItem("demo-mode", "false");
    } catch (error) {
      console.error("Failed to disable demo mode:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value = React.useMemo(
    () => ({
      isDemoMode: isDemoModeActive,
      enableDemo,
      disableDemo,
      isLoading,
    }),
    [isDemoModeActive, enableDemo, disableDemo, isLoading]
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemoMode() {
  const context = React.useContext(DemoContext);
  if (context === undefined) {
    throw new Error("useDemoMode must be used within a DemoProvider");
  }
  return context;
}
