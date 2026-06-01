"use client";

import { motion } from "motion/react";

import { BankConnectionCard } from "@/components/settings/bank-connection-card";

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col gap-2"
      >
        <h1 className="text-glow text-4xl font-bold tracking-tight">
          <span className="from-foreground to-foreground/50 bg-gradient-to-r bg-clip-text text-transparent">
            Settings
          </span>
        </h1>
        <p className="text-muted-foreground">
          Manage your bank connections and app preferences.
        </p>
      </motion.div>

      {/* Bank Connection section */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        className="flex flex-col gap-4"
      >
        <h2 className="text-foreground text-lg font-semibold">
          Bank Connection
        </h2>
        <BankConnectionCard />
      </motion.section>
    </div>
  );
}
