"use client";

import { motion } from "motion/react";
import { Coffee, ShoppingCart, Zap, Home, ArrowUpRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

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
            <CardContent className="space-y-4">
                {transactions.map((tx, index) => (
                    <motion.div
                        key={tx.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 + 0.3 }}
                        className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors group cursor-pointer"
                    >
                        <div className="flex items-center gap-4">
                            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${tx.bg} ${tx.color} group-hover:scale-110 transition-transform`}>
                                <tx.icon className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="font-medium text-foreground">{tx.title}</p>
                                <p className="text-xs text-muted-foreground">{tx.date}</p>
                            </div>
                        </div>
                        <div className={`font-semibold ${tx.amount.startsWith('+') ? 'text-emerald-400' : 'text-foreground'}`}>
                            {tx.amount}
                        </div>
                    </motion.div>
                ))}
            </CardContent>
        </Card>
    );
}
