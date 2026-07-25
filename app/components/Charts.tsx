import React, { useEffect, useState } from "react";
import { format, getDaysInMonth } from "date-fns";
import type { DagobertTransactionGroup } from "@/src/modules/transaction-group";
import { clientUseCases } from "@/src/shared/composition/clientUseCases";

const listTransactionGroupsUseCase = clientUseCases.listTransactionGroups;

type Transaction = {
  groupId: string;
  pair: string;
  amount: number;
  executed: number;
  lastTransDateEpoch: number;
  //comment: string;
};

type ProfitVisualizerProps = {
  data: Transaction[];
  pixelPerProfit?: number; // Configurable, default is 10 cents = 1 pixel
};

const Charts: React.FC = () => {
  const pixelPerProfit = 10;
  const [data, setData] = useState<DagobertTransactionGroup[]>([]);

  useEffect(() => {
    listTransactionGroupsUseCase.execute().then(setData);
  }, []);
  const data2: { [id: string]: Transaction } = {
    "a0afeec2-e370-4089-8e35-bd0dd9a0755e": {
      groupId: "a0afeec2-e370-4089-8e35-bd0dd9a0755e",
      pair: "AVAXUSDT",
      amount: -0.23000000000000043,
      executed: 0,
      lastTransDateEpoch: 1654976280000,
    },
    "7d4ba310-a98c-4163-a215-92019c6e6283": {
      groupId: "7d4ba310-a98c-4163-a215-92019c6e6283",
      pair: "ETHUSDT",
      amount: -4.049999999999997,
      executed: 0,
      lastTransDateEpoch: 1655098920000,
    },
    "dc68602e-c430-405e-bfc6-837f2ba408b5": {
      groupId: "dc68602e-c430-405e-bfc6-837f2ba408b5",
      pair: "AVAXUSDT",
      amount: 0.79,
      executed: 0,
      lastTransDateEpoch: 1655098900000,
    },
    "8503325c-d739-4270-83d5-2c21d7b71c63": {
      groupId: "8503325c-d739-4270-83d5-2c21d7b71c63",
      pair: "XRPUSDT",
      amount: 1.8500000000000014,
      executed: 0,
      lastTransDateEpoch: 1656237300000,
    },
    "44481b0d-0407-43cb-bc34-83bb5846ad1b": {
      groupId: "44481b0d-0407-43cb-bc34-83bb5846ad1b",
      pair: "SOLUSDT",
      amount: -4.040000000000001,
      executed: 5.551115123125783e-17,
      lastTransDateEpoch: 1661769000000,
    },
    "3595856d-abd8-4bd9-bff5-6304ad83d6b4": {
      groupId: "3595856d-abd8-4bd9-bff5-6304ad83d6b4",
      pair: "ARBUSDT",
      amount: 0.8100000000000005,
      executed: 0.10000000000000009,
      lastTransDateEpoch: 1709662200000,
    },
    "722311b1-bd1f-4789-ba97-ffac55b4ea6c": {
      groupId: "722311b1-bd1f-4789-ba97-ffac55b4ea6c",
      pair: "XRPUSDT",
      amount: 0.8000000000000007,
      executed: 0,
      lastTransDateEpoch: 1736752040563,
    },
    "ee70a360-d111-412a-8375-14e9906fc33b": {
      groupId: "ee70a360-d111-412a-8375-14e9906fc33b",
      pair: "SOLUSDC",
      amount: 0.03999999999999915,
      executed: 0,
      lastTransDateEpoch: 1735452000000,
    },
    "0314822f-9c7c-4428-9a36-ade10171b3b7": {
      groupId: "0314822f-9c7c-4428-9a36-ade10171b3b7",
      pair: "SOLUSDT",
      amount: 2.469999999999997,
      executed: 0,
      lastTransDateEpoch: 1708590600000,
    },
  };

  // Process transactions into daily profits
  const groupedData = data.reduce((acc, transaction) => {
    const date = format(new Date(transaction.lastTransDateEpoch), "yyyy-MM-dd");
    if (!acc[date]) {
      acc[date] = { profit: 0, transactionsInfo: [] };
    }
    acc[date].profit += transaction.amount;
    acc[date].transactionsInfo.push([
      transaction.pair,
      transaction.amount.toFixed(2) + "$",
    ]);

    return acc;
  }, {} as Record<string, { profit: number; transactionsInfo: [pair: string, amount: string][] }>);

  // Organize data by year and month
  const yearMonthData = Object.entries(groupedData).reduce(
    (acc, [date, { profit, transactionsInfo }]) => {
      const [year, month, day] = date.split("-");
      const yearKey = `${year}`;
      const monthKey = `${month}`;

      if (!acc[yearKey]) acc[yearKey] = { total: 0, months: {} };
      if (!acc[yearKey].months[monthKey])
        acc[yearKey].months[monthKey] = { total: 0, days: {} };

      acc[yearKey].total += profit;
      acc[yearKey].months[monthKey].total += profit;
      acc[yearKey].months[monthKey].days[Number(day)] = {
        profit,
        transactionsInfo,
      };

      return acc;
    },
    {} as Record<
      string,
      {
        total: number;
        months: Record<
          string,
          {
            total: number;
            days: {
              [day: number]: {
                profit: number;
                transactionsInfo: [pair: string, amount: string][];
              };
            };
          }
        >;
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
                        const dayInfo = days[day] || 0;
                        return (
                          <div key={day} className="flex flex-col items-center">
                            {dayInfo.profit && (
                              <div
                                className={
                                  dayInfo.profit >= 0
                                    ? "bg-green-500"
                                    : "bg-red-500"
                                }
                                style={{
                                  height: `${
                                    Math.abs(dayInfo.profit) * pixelPerProfit
                                  }px`,
                                  width: "10px",
                                }}
                                title={`Day: ${day}, Profit: $${dayInfo.profit.toFixed(
                                  2
                                )} | ${JSON.stringify(
                                  dayInfo.transactionsInfo
                                )}`}
                              ></div>
                            )}
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

export default Charts;
