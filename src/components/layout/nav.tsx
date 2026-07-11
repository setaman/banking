"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function Nav() {
  const pathname = usePathname();

  const links = [
    { href: "/", label: "Dashboard" },
    { href: "/insights", label: "Insights" },
    { href: "/transactions", label: "Transactions" },
    { href: "/sandbox", label: "Sandbox" },
    { href: "/assistant", label: "Assistant" },
    { href: "/settings", label: "Settings" },
  ];

  return (
    <nav className="flex items-center gap-6">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            "hover:text-primary text-sm font-medium transition-colors",
            pathname === link.href ? "text-primary" : "text-muted-foreground"
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
