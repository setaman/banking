"use client";

import { motion } from "motion/react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const data = [
    { day: "Mon", value: 40 },
    { day: "Tue", value: 70 },
    { day: "Wed", value: 30 },
    { day: "Thu", value: 85 },
    { day: "Fri", value: 50 },
    { day: "Sat", value: 90 },
    { day: "Sun", value: 60 },
];

export function SpendingChart() {
    return (
        <Card className="flex flex-col h-full">
            <CardHeader>
                <CardTitle>Weekly Spending</CardTitle>
            </CardHeader>

            <CardContent className="flex-1 flex items-end justify-between gap-4 mt-4 min-h-[200px]">
                {data.map((item, index) => (
                    <div key={item.day} className="flex flex-col items-center gap-2 flex-1 group">
                        <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: `${item.value}%` }}
                            transition={{ duration: 1, delay: index * 0.1, type: "spring" }}
                            className="w-full bg-gradient-to-t from-primary/20 to-primary rounded-t-lg relative overflow-hidden group-hover:opacity-80 transition-opacity"
                        >
                            <div className="absolute inset-x-0 top-0 h-full bg-gradient-to-b from-white/20 to-transparent" />
                        </motion.div>
                        <span className="text-xs text-muted-foreground font-medium group-hover:text-primary transition-colors">{item.day}</span>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
