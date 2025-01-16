import React from "react";
import { format, getDaysInMonth } from "date-fns";
import DtransactionGroups from "../lib/DtransactionGroups";

type Transaction = {
  groupId: string;
  pair: string;
  amount: number;
  executed: number;
  lastTransDateEpoch: number;
};

type ProfitVisualizerProps = {
  data: Transaction[];
  pixelPerProfit?: number; // Configurable, default is 10 cents = 1 pixel
};

const PageOrderHistory: React.FC = () => {
  const pixelPerProfit = 10;
  const data = DtransactionGroups.getAll() ?? [];
  const data2: Transaction[] = [
    {
      groupId: "a0afeec2-e370-4089-8e35-bd0dd9a0755e",
      pair: "AVAXUSDT",
      amount: -0.23000000000000043,
      executed: 0,
      lastTransDateEpoch: 1654976280000,
    },
    {
      groupId: "7d4ba310-a98c-4163-a215-92019c6e6283",
      pair: "ETHUSDT",
      amount: -4.049999999999997,
      executed: 0,
      lastTransDateEpoch: 1655098920000,
    },
    {
      groupId: "dc68602e-c430-405e-bfc6-837f2ba408b5",
      pair: "AVAXUSDT",
      amount: 0.79,
      executed: 0,
      lastTransDateEpoch: 1655098900000,
    },
    {
      groupId: "8503325c-d739-4270-83d5-2c21d7b71c63",
      pair: "XRPUSDT",
      amount: 1.8500000000000014,
      executed: 0,
      lastTransDateEpoch: 1656237300000,
    },
    {
      groupId: "44481b0d-0407-43cb-bc34-83bb5846ad1b",
      pair: "SOLUSDT",
      amount: -4.040000000000001,
      executed: 5.551115123125783e-17,
      lastTransDateEpoch: 1661769000000,
    },
    {
      groupId: "3595856d-abd8-4bd9-bff5-6304ad83d6b4",
      pair: "ARBUSDT",
      amount: 0.8100000000000005,
      executed: 0.10000000000000009,
      lastTransDateEpoch: 1709662200000,
    },
    {
      groupId: "722311b1-bd1f-4789-ba97-ffac55b4ea6c",
      pair: "XRPUSDT",
      amount: 0.8000000000000007,
      executed: 0,
      lastTransDateEpoch: 1736752040563,
    },
    {
      groupId: "ee70a360-d111-412a-8375-14e9906fc33b",
      pair: "SOLUSDC",
      amount: 0.03999999999999915,
      executed: 0,
      lastTransDateEpoch: 1735452000000,
    },
    {
      groupId: "0314822f-9c7c-4428-9a36-ade10171b3b7",
      pair: "SOLUSDT",
      amount: 2.469999999999997,
      executed: 0,
      lastTransDateEpoch: 1708590600000,
    },
  ];

  // Process transactions into daily profits
  const groupedData = data.reduce((acc, transaction) => {
    const date = format(new Date(transaction.lastTransDateEpoch), "yyyy-MM-dd");
    acc[date] = (acc[date] || 0) + transaction.amount;
    return acc;
  }, {} as Record<string, number>);

  // Organize data by year and month
  const yearMonthData = Object.entries(groupedData).reduce(
    (acc, [date, profit]) => {
      const [year, month, day] = date.split("-");
      const yearKey = `${year}`;
      const monthKey = `${month}`;

      if (!acc[yearKey]) acc[yearKey] = { total: 0, months: {} };
      if (!acc[yearKey].months[monthKey])
        acc[yearKey].months[monthKey] = { total: 0, days: {} };

      acc[yearKey].total += profit;
      acc[yearKey].months[monthKey].total += profit;
      acc[yearKey].months[monthKey].days[Number(day)] = profit;

      return acc;
    },
    {} as Record<
      string,
      {
        total: number;
        months: Record<string, { total: number; days: Record<number, number> }>;
      }
    >
  );

  // Sort years and months in reverse order
  const sortedYears = Object.entries(yearMonthData).sort(
    (a, b) => Number(b[0]) - Number(a[0])
  );

  return (
    <div className="p-4">
      {sortedYears.map(([year, { total: yearTotal, months }]) => (
        <div key={year} className="mb-8">
          <h2 className="text-xl font-bold mb-4">
            {year} (Total: ${yearTotal.toFixed(2)})
          </h2>
          {Object.entries(months)
            .sort((a, b) => Number(b[0]) - Number(a[0]))
            .map(([month, { total: monthTotal, days }]) => {
              const daysInMonth = getDaysInMonth(
                new Date(Number(year), Number(month) - 1)
              );
              return (
                <div key={month} className="mb-6">
                  <h3 className="text-lg font-semibold mb-2">
                    {format(new Date(Number(year), Number(month) - 1), "MMMM")}{" "}
                    (Total: ${monthTotal.toFixed(2)})
                  </h3>
                  <div className="flex items-end gap-1">
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(
                      (day) => {
                        const profit = days[day] || 0;
                        return (
                          <div key={day} className="flex flex-col items-center">
                            <div
                              className={
                                profit >= 0 ? "bg-green-500" : "bg-red-500"
                              }
                              style={{
                                height: `${
                                  Math.abs(profit) * pixelPerProfit
                                }px`,
                                width: "10px",
                              }}
                              title={`Day: ${day}, Profit: $${profit.toFixed(
                                2
                              )}`}
                            ></div>
                            <span className="text-xs mt-1">{day}</span>
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      ))}
    </div>
  );
};

export default PageOrderHistory;
