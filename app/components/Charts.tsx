import React, { useEffect, useState } from "react";
import { format, getDaysInMonth } from "date-fns";
import type { DagobertTransactionGroup } from "@/src/modules/transaction-group";
import { clientUseCases } from "@/src/shared/composition/clientUseCases";

const listTransactionGroupsUseCase = clientUseCases.listTransactionGroups;

const Charts: React.FC = () => {
  const pixelPerProfit = 10;
  const [data, setData] = useState<DagobertTransactionGroup[]>([]);

  useEffect(() => {
    listTransactionGroupsUseCase.execute().then(setData);
  }, []);
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
