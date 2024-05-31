"use client";

import {
  EChart,
  ReactEChartsProps,
} from "@/src/components/Dashboard/Charts/EChart";
import { StatsI, TimeSeriesI } from "@/src/types";
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
  let timeSeries: TimeSeriesI[] = [];
  stats.transactionsGroupByDay.forEach(group => {
    let sum: number = 0;
    group.transactions.forEach(t => sum += t.amount * -1);

    timeSeries.push({
      date: format(group.date, "dd.MM.yyyy"),
      value: sum,
    });
  });

  option.series[0].data = timeSeries.map((t) => t.value);
  option.xAxis.data = timeSeries.map((t) => t.date);
  return <EChart option={option} />;
}
