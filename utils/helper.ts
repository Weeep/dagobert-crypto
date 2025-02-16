import { PairPriceIf, TransactionIf } from "@/app/lib/Interfaces";
import {
  BnceTradeHisFromCsv,
  DagobertTransaction,
  TradeType,
} from "@/utils/typesAndEnums";
import { parse } from "date-fns";
import { v4 as uuidv4 } from "uuid";

export const greenPipe = "\u2705"; // ✅ Green check mark
export const redCross = "\u274C"; // ❌ Red cross
export const rightPointingTriangle = "\u25B6";
export const downPointingTriangle = "\u25BC";

export const isTransactionIf = (data: any): boolean => {
  return (
    data &&
    typeof data === "object" &&
    "symbol" in data &&
    "orderId" in data &&
    "executedQty" in data &&
    "cummulativeQuoteQty" in data &&
    "status" in data &&
    "type" in data &&
    "side" in data &&
    "updateTime" in data
  );
};

export const isTransactionIfArray = (data: any): boolean => {
  if (!data || !Array.isArray(data)) {
    return false;
  }

  for (const d of data) {
    if (!isTransactionIf(d)) {
      return false;
    }
  }

  return true;
};

export const isBnceTradeHisFromCsv = (data: any): boolean => {
  return (
    data &&
    typeof data === "object" &&
    "Date(UTC)" in data &&
    "Pair" in data &&
    "Side" in data &&
    "Price" in data &&
    "Executed" in data &&
    "Amount" in data &&
    "Fee" in data
  );
};

export const isBnceTradeHisFromCsvArray = (data: any): boolean => {
  if (!data || !Array.isArray(data)) {
    return false;
  }

  for (const d of data) {
    if (!isBnceTradeHisFromCsv(d)) {
      return false;
    }
  }

  return true;
};

export const convertArrayToObject = <T, K extends keyof T>(
  array: T[],
  key: K
): { [key: string]: T } => {
  return array.reduce((obj: { [key: string]: T }, item: T) => {
    obj[String(item[key])] = item; // Convert key to string to ensure compatibility
    return obj;
  }, {});
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

export function decreaseLastDigitByTwo(num: number): number {
  return modifyLastDigit(num, -2);
}

export function increaseLastDigitByTwo(num: number): number {
  return modifyLastDigit(num, 2);
}

export function modifyLastDigit(
  num: number,
  modifier: number //"increase" | "decrease"
): number {
  const numStr = num.toString();
  //const modifier = action === "increase" ? 2 : -2;

  // Find the position of the last digit
  const decimalIndex = numStr.indexOf(".");
  let resultStr;

  if (decimalIndex === -1) {
    // No decimal point: integer number
    const lastDigit = parseInt(numStr[numStr.length - 1], 10);
    resultStr = numStr.slice(0, -1) + (lastDigit + modifier).toString();
  } else {
    // Decimal number
    const lastDigitIndex = numStr.length - 1;
    const lastDigit = parseInt(numStr[lastDigitIndex], 10);
    resultStr =
      numStr.slice(0, lastDigitIndex) + (lastDigit + modifier).toString();
  }

  // Convert the result back to a number
  return parseFloat(resultStr);
}
