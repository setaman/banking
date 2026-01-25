"use client";

import { useState } from "react";
import Link from "next/link";
import { Nav } from "./nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { DemoToggle } from "@/components/demo-toggle";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Header() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="fixed top-0 z-50 w-full pt-4 px-4 sm:px-6">
      <div className="glass-panel mx-auto flex h-16 max-w-7xl items-center justify-between rounded-full px-6 sm:px-8 transition-all hover:bg-card/70">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="flex items-center space-x-2 transition-transform hover:scale-105"
          >
            <div className="bg-primary/20 flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-md">
              <span className="text-primary text-xl font-bold">B</span>
            </div>
            <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-xl font-bold text-transparent">
              BanKing
            </span>
          </Link>
          <div className="hidden md:block">
            <Nav />
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden sm:flex items-center gap-2 sm:gap-4">
            <DemoToggle />
            <ThemeToggle />
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden rounded-full h-10 w-10"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Nav Overlay */}
      <div
        className={cn(
          "absolute top-24 left-4 right-4 z-40 md:hidden transition-all duration-300 transform origin-top",
          isOpen
            ? "scale-100 opacity-100 pointer-events-auto"
            : "scale-95 opacity-0 pointer-events-none",
        )}
      >
        <div className="glass-panel p-6 rounded-3xl shadow-2xl border border-white/10 dark:border-white/5 space-y-6">
          <div className="flex flex-col gap-4">
            <Nav />
          </div>
          <div className="flex items-center justify-between pt-4 border-t border-border/50">
            <span className="text-sm font-medium text-muted-foreground">
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
