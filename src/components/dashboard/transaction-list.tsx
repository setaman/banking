"use client";

import { motion } from "motion/react";
import { Coffee, ShoppingCart, Zap, Home, ArrowUpRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  ItemGroup,
  Item,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "@/components/ui/item";

const transactions = [
    {
        id: 1,
        title: "Grocery Shopping",
        category: "Shopping",
        amount: "-$120.50",
        date: "Today, 10:23 AM",
        icon: ShoppingCart,
        color: "text-orange-400",
        bg: "bg-orange-500/10",
    },
    {
        id: 2,
        title: "Electric Bill",
        category: "Utilities",
        amount: "-$45.00",
        date: "Yesterday, 2:15 PM",
        icon: Zap,
        color: "text-amber-400",
        bg: "bg-amber-500/10",
    },
    {
        id: 3,
        title: "Freelance Payment",
        category: "Income",
        amount: "+$850.00",
        date: "Jan 20, 9:00 AM",
        icon: ArrowUpRight,
        color: "text-emerald-400",
        bg: "bg-emerald-500/10",
    },
    {
        id: 4,
        title: "Coffee Shop",
        category: "Food",
        amount: "-$12.00",
        date: "Jan 19, 4:30 PM",
        icon: Coffee,
        color: "text-amber-700",
        bg: "bg-amber-700/10",
    },
    {
        id: 5,
        title: "Rent Payment",
        category: "Housing",
        amount: "-$1,200.00",
        date: "Jan 15, 12:00 PM",
        icon: Home,
        color: "text-blue-400",
        bg: "bg-blue-500/10",
    },
];

export function TransactionList() {
    return (
        <Card className="flex flex-col h-full">
            <CardHeader>
                <CardTitle>Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
                <ItemGroup className="gap-3">
                    {transactions.map((tx, index) => (
                        <motion.div
                            key={tx.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 + 0.3 }}
                        >
                            <Item variant="outline">
                                <ItemMedia className={`h-10 w-10 rounded-full ${tx.bg} ${tx.color}`}>
                                    <tx.icon className="h-5 w-5" />
                                </ItemMedia>
                                <ItemContent>
                                    <ItemTitle>{tx.title}</ItemTitle>
                                    <ItemDescription>{tx.date}</ItemDescription>
                                </ItemContent>
                                <ItemActions>
                                    <span className={`font-semibold ${tx.amount.startsWith('+') ? 'text-emerald-400' : 'text-foreground'}`}>
                                        {tx.amount}
                                    </span>
                                </ItemActions>
                            </Item>
                        </motion.div>
                    ))}
                </ItemGroup>
            </CardContent>
        </Card>
    );
}
