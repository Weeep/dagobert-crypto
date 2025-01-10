import { TransactionIf } from "@/app/components/Interfaces";
import {
  BnceTradeHisFromCsv,
  DagobertTransaction,
} from "@/utils/typesAndEnums";
import { parse } from "date-fns";
import { v4 as uuidv4 } from "uuid";

export const binanceCsvFileToDTransactions = (
  csvTransactions: BnceTradeHisFromCsv[]
): { [pair: string]: DagobertTransaction[] } => {
  let dtransactionsPerPair: { [pair: string]: DagobertTransaction[] } = {};
  csvTransactions.map((csvTrans) => {
    const dateString = csvTrans["Date(UTC)"];
    const parsedDate = parse(dateString, "MM/dd/yyyy HH:mm", new Date());
    const parsedDateEpoch = parsedDate.getTime();
    const amount = stringToRoundedFloat(csvTrans.Amount, 2);

    const dtransaction: DagobertTransaction = {
      orderId: uuidv4(),
      pair: csvTrans.Pair,
      amount: csvTrans.Side === "SELL" ? amount : 0 - amount,
      dateEpoch: parsedDateEpoch,
      date: parsedDate,
      side: csvTrans.Side,
      executed: stringToRoundedFloat(csvTrans.Executed),
      price: stringToRoundedFloat(csvTrans.Price),
      status: "FILLED", // csv file contains FILLED only! (?)
      grouped: false,
    };

    dtransactionsPerPair[csvTrans.Pair] =
      dtransactionsPerPair[csvTrans.Pair] ?? [];
    dtransactionsPerPair[csvTrans.Pair].push(dtransaction);
  });

  return dtransactionsPerPair;
};

export const binanceApiOrdersToDTransactions = (
  apiTransactions: TransactionIf[]
): { [pair: string]: DagobertTransaction[] } => {
  let dtransactionsPerPair: { [pair: string]: DagobertTransaction[] } = {};

  apiTransactions.map((apiTransaction) => {
    const cqq = stringToRoundedFloat(apiTransaction.cummulativeQuoteQty, 2);

    const dtransaction: DagobertTransaction = {
      orderId: uuidv4(),
      pair: apiTransaction.symbol,
      amount: apiTransaction.side === "SELL" ? cqq : 0 - cqq,
      dateEpoch: apiTransaction.updateTime - 60 * 60000 - 60000, // TODO -1 óra és 1 perc, hogy ne duplikálja a csv utolsó tranzakcióját
      date: new Date(apiTransaction.updateTime),
      side: apiTransaction.side,
      executed: stringToRoundedFloat(apiTransaction.executedQty),
      price: stringToRoundedFloat(
        getPrice(apiTransaction.cummulativeQuoteQty, apiTransaction.executedQty)
      ),
      status: apiTransaction.status,
      grouped: false,
    };

    dtransactionsPerPair[apiTransaction.symbol] =
      dtransactionsPerPair[apiTransaction.symbol] ?? [];
    dtransactionsPerPair[apiTransaction.symbol].push(dtransaction);
  });

  return dtransactionsPerPair;
};

export const formatDate = (epoch: number): string => {
  const date = new Date(epoch);
  return new Intl.DateTimeFormat("hu-HU", {
    year: "numeric", //2-digit", //numeric
    month: "short",
    day: "2-digit",
    /*hour: "2-digit",
    minute: "2-digit",*/
    hour12: false, // Use 24-hour format
  }).format(date);
};

export function stringToRoundedFloat(
  strNum: any,
  fixedTo: number = 0,
  multiplier: number = 1
) {
  const num = parseFloat(strNum as unknown as string);
  let fixed = fixedTo;
  if (fixed == 0) {
    fixed = 3;
    if (num <= 1) fixed = 4;
    if (num <= 0.0001) fixed = 8;

    if (num >= 10) fixed = 2;
    if (num >= 100) fixed = 2; //1
    if (num >= 1000) fixed = 2; //0
    if (num >= 10000) fixed = 0;
  }

  return parseFloat((num * multiplier).toFixed(fixed));
}

export function getTargetPrices(initialNumber: number, targets: number[]) {
  return targets.map((target) => {
    return stringToRoundedFloat(
      parseFloat(((initialNumber * (100 + target)) / 100) as unknown as string)
    );
  });
}

export function getPrice(cummulativeQuoteQty: string, executedQty: string) {
  return (executedQty as unknown as number) != 0
    ? (cummulativeQuoteQty as unknown as number) /
        (executedQty as unknown as number)
    : 0;
}
