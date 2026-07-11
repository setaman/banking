import { tool } from "ai";
import { getDay, parseISO } from "date-fns";
import { z } from "zod";

import { getTransactions } from "@/actions/transactions.actions";
import { calculateDailyAverage } from "@/lib/stats/calculations";

import { isoDateParam, round2 } from "./shared";

const paramsSchema = z.object({
  startDate: isoDateParam(
    "Inclusive start date (YYYY-MM-DD). Omit to include all history."
  ).optional(),
  endDate: isoDateParam(
    "Inclusive end date (YYYY-MM-DD). Omit to include all history."
  ).optional(),
});

export interface GetSpendingPatternsResult {
  readonly dailyAverageSpend: number;
  readonly weekday: {
    readonly totalSpend: number;
    readonly dayCount: number;
    readonly averagePerDay: number;
  };
  readonly weekend: {
    readonly totalSpend: number;
    readonly dayCount: number;
    readonly averagePerDay: number;
  };
}

export const getSpendingPatternsTool = tool({
  description:
    "Returns overall daily average spend plus a weekday-vs-weekend spending comparison (total, distinct days with spending, and average per day for each), in EUR. Use this to answer 'do I spend more on weekends' style questions.",
  inputSchema: paramsSchema,
  execute: async ({
    startDate,
    endDate,
  }): Promise<GetSpendingPatternsResult> => {
    const transactions = await getTransactions(
      { startDate, endDate },
      { excludeInternal: true }
    );

    const dateRange =
      startDate && endDate
        ? { start: parseISO(startDate), end: parseISO(endDate) }
        : undefined;
    const dailyAverage = calculateDailyAverage(transactions, dateRange);

    let weekdayTotal = 0;
    let weekendTotal = 0;
    const weekdayDays = new Set<string>();
    const weekendDays = new Set<string>();

    for (const tx of transactions) {
      if (tx.amount >= 0) continue;

      const dayOfWeek = getDay(parseISO(tx.bookingDate));
      const absAmount = Math.abs(tx.amount);

      if (dayOfWeek === 0 || dayOfWeek === 6) {
        weekendTotal += absAmount;
        weekendDays.add(tx.bookingDate);
      } else {
        weekdayTotal += absAmount;
        weekdayDays.add(tx.bookingDate);
      }
    }

    return {
      dailyAverageSpend: round2(dailyAverage.average),
      weekday: {
        totalSpend: round2(weekdayTotal),
        dayCount: weekdayDays.size,
        averagePerDay: round2(
          weekdayDays.size > 0 ? weekdayTotal / weekdayDays.size : 0
        ),
      },
      weekend: {
        totalSpend: round2(weekendTotal),
        dayCount: weekendDays.size,
        averagePerDay: round2(
          weekendDays.size > 0 ? weekendTotal / weekendDays.size : 0
        ),
      },
    };
  },
});
