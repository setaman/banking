"use client";

import {
  EChart,
  ReactEChartsProps,
} from "@/src/components/Dashboard/Charts/EChart";
import { StatsI } from "@/src/types";
import { format } from "date-fns";

const option: ReactEChartsProps["option"] = {
  xAxis: {
    data: [],
    splitLine: {
      show: false,
    },
  },
  yAxis: {},
  series: [
    {
      name: "bar",
      type: "bar",
      data: [],
      itemStyle: {
        borderRadius: 5,
        color: "rgb(37, 99, 235)",
      },
      emphasis: {
        focus: "series",
      },
      animationDelay: function (idx) {
        return idx * 10;
      },
    },
  ],
};

export function IncomeExpenseDistribution({ stats }: { stats: StatsI }) {
  const transactions = stats.transactionsByMonth[0].transactions;
  option.series[0].data = transactions.map((t) => t.amount);
  option.xAxis.data = transactions.map((t) =>
    format(t.authorized_date, "dd.MM")
  );
  return <EChart option={option} />;
}
