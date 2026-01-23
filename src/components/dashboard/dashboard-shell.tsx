"use client";

import { motion } from "motion/react";

export function DashboardShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="container mx-auto max-w-7xl pt-24 px-4 pb-8 space-y-8">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="flex flex-col gap-8"
            >
                {children}
            </motion.div>
        </div>
    );
}
