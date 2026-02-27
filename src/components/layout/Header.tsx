"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Nav } from "./nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { DemoToggle } from "@/components/demo-toggle";
import { SyncButton } from "@/components/sync-button";
import { SyncStatus } from "@/components/sync-status";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Header() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="fixed top-0 z-50 w-full px-4 pt-4 sm:px-6">
      <div className="glass-panel hover:bg-card/70 mx-auto flex h-16 max-w-7xl items-center justify-between rounded-full px-6 transition-all sm:px-8">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="flex items-center space-x-2 transition-transform hover:scale-105"
          >
            <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-[14px] ring-1 ring-white/10 transition-all duration-300">
              <Image
                src="/logo-dark.png"
                alt="BanKing Logo"
                fill
                className="hidden object-cover dark:block"
              />
              <Image
                src="/logo-light.png"
                alt="BanKing Logo"
                fill
                className="block object-cover dark:hidden"
              />
            </div>
            <span className="from-foreground to-foreground/70 bg-gradient-to-r bg-clip-text text-2xl font-bold text-transparent tracking-tight">
              BanKing
            </span>
          </Link>
          <div className="hidden md:block">
            <Nav />
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {/* Sync Status - Desktop only */}
          <div className="hidden items-center lg:flex">
            <SyncStatus />
          </div>

          <div className="hidden items-center gap-2 sm:flex sm:gap-3">
            <SyncButton />
            <div className="bg-border/50 h-6 w-px" />
            <DemoToggle />
            <ThemeToggle />
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full md:hidden"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Nav Overlay */}
      <div
        className={cn(
          "absolute top-24 right-4 left-4 z-40 origin-top transform transition-all duration-300 md:hidden",
          isOpen
            ? "pointer-events-auto scale-100 opacity-100"
            : "pointer-events-none scale-95 opacity-0"
        )}
      >
        <div className="glass-panel space-y-6 rounded-3xl border border-white/10 p-6 shadow-2xl dark:border-white/5">
          <div className="flex flex-col gap-4">
            <Nav />
          </div>

          {/* Sync status in mobile menu */}
          <div className="border-border/50 flex items-center justify-between border-t pt-4">
            <SyncStatus />
            <SyncButton />
          </div>

          <div className="border-border/50 flex items-center justify-between border-t pt-4">
            <span className="text-muted-foreground text-sm font-medium">
              Settings
            </span>
            <div className="flex items-center gap-4">
              <DemoToggle />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
