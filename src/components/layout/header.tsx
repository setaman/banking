import Link from "next/link";
import { Nav } from "./nav";
import { ThemeToggle } from "@/components/theme-toggle";

export function Header() {
  return (
    <header className="fixed top-0 z-50 w-full pt-4 px-4">
      <div className="glass-panel mx-auto flex h-16 max-w-7xl items-center justify-between rounded-full px-8 transition-all hover:bg-card/70">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center space-x-2 transition-transform hover:scale-105">
            <div className="bg-primary/20 flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-md">
              <span className="text-primary text-xl font-bold">B</span>
            </div>
            <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-xl font-bold text-transparent">
              BanKing
            </span>
          </Link>
          <Nav />
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
