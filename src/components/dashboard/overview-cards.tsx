"use client";

import { ArrowUpRight, ArrowDownRight, Wallet } from "lucide-react";
import { motion } from "motion/react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";

const MotionCard = motion.create(Card);

const cards = [
  {
    title: "Total Balance",
    amount: "$12,450.00",
    change: "+2.5%",
    trend: "up",
    icon: Wallet,
    gradient: "from-blue-500/20 to-purple-500/20",
    border: "border-blue-500/20",
    textGradient: "from-blue-400 to-purple-400",
  },
  {
    title: "Income",
    amount: "$4,200.00",
    change: "+12%",
    trend: "up",
    icon: ArrowUpRight,
    gradient: "from-emerald-500/20 to-teal-500/20",
    border: "border-emerald-500/20",
    textGradient: "from-emerald-400 to-teal-400",
  },
  {
    title: "Expenses",
    amount: "$1,850.00",
    change: "-5%",
    trend: "down",
    icon: ArrowDownRight,
    gradient: "from-rose-500/20 to-orange-500/20",
    border: "border-rose-500/20",
    textGradient: "from-rose-400 to-orange-400",
  },
];

export function OverviewCards() {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {cards.map((card, index) => (
        <MotionCard
          key={card.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className={`relative overflow-hidden ${card.border}`}
        >
          <div
            className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-50`}
          />

          <CardHeader className="relative z-10 flex flex-row items-center justify-between pb-2">
            <p className="text-muted-foreground text-sm font-medium">
              {card.title}
            </p>
            <div className="bg-background/20 rounded-xl p-2 backdrop-blur-md">
              <card.icon
                className={`h-4 w-4 ${card.trend === "up" ? "text-emerald-400" : "text-rose-400"}`}
              />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <h3
              className={`bg-gradient-to-r text-3xl font-bold ${card.textGradient} bg-clip-text text-transparent`}
            >
              {card.amount}
            </h3>
            <div className="mt-2 flex items-center text-sm">
              <span
                className={`${card.trend === "up" ? "text-emerald-400" : "text-rose-400"} flex items-center gap-1 font-medium`}
              >
                {card.change}
              </span>
              <span className="text-muted-foreground ml-2">vs last month</span>
            </div>
          </CardContent>
        </MotionCard>
      ))}
    </div>
  );
}
