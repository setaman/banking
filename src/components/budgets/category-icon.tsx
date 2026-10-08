import {
  Bus,
  Coffee,
  CreditCard,
  Film,
  Heart,
  Home,
  MoreHorizontal,
  Plane,
  Repeat,
  ShoppingBag,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

/** Lucide icon per category id. */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Groceries: ShoppingCart,
  Rent: Home,
  Bills: CreditCard,
  Transport: Bus,
  Travel: Plane,
  Entertainment: Film,
  Healthcare: Heart,
  Shopping: ShoppingBag,
  Dining: Coffee,
  Subscriptions: Repeat,
};

/** Category icon, consistent with the Transactions page icon mapping. */
export function CategoryIcon({
  category,
  className,
}: {
  category: string;
  className?: string;
}) {
  const Icon = CATEGORY_ICONS[category] ?? MoreHorizontal;
  return <Icon className={cn("h-4 w-4", className)} aria-hidden />;
}
