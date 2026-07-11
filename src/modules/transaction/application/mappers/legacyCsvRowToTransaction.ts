import { stringToRoundedFloat } from "@/utils/helper";
import type { BnceTradeHisFromCsv } from "../../dto/legacy/BnceTradeHisFromCsv";
import type { DagobertTransaction } from "../../domain/DagobertTransaction";
import { TradeStyle } from "../../domain/TradeStyle";
import { TradeType } from "../../domain/TradeType";
import { parse } from "date-fns";
import { v4 as uuidv4 } from "uuid";

export function legacyCsvRowToTransaction(
  csvTrans: BnceTradeHisFromCsv,
  tradeType: TradeType
): DagobertTransaction {
  const parsedDate = parse(csvTrans["Date(UTC)"], "MM/dd/yyyy HH:mm", new Date());
  const amount = stringToRoundedFloat(csvTrans.Amount, 2);

  return {
    orderId: uuidv4(),
    binanceApiId: -1,
    pair: csvTrans.Pair,
    amount: csvTrans.Side === "SELL" ? amount : 0 - amount,
    dateEpoch: parsedDate.getTime(),
    date: parsedDate,
    side: csvTrans.Side,
    executed: stringToRoundedFloat(csvTrans.Executed),
    price: stringToRoundedFloat(csvTrans.Price),
    status: "FILLED",
    grouped: false,
    note: "",
    otherSideOrderId: "",
    tradeType,
    tradeStyle: TradeStyle.Swing,
  };
}

export function legacyCsvRowsToTransactionsByPair(
  csvTransactions: BnceTradeHisFromCsv[],
  tradeType: TradeType
): Record<string, DagobertTransaction[]> {
  return csvTransactions.reduce<Record<string, DagobertTransaction[]>>(
    (dtransactionsPerPair, csvTrans) => {
      const dtransaction = legacyCsvRowToTransaction(csvTrans, tradeType);
      dtransactionsPerPair[csvTrans.Pair] = dtransactionsPerPair[csvTrans.Pair] ?? [];
      dtransactionsPerPair[csvTrans.Pair].push(dtransaction);
      return dtransactionsPerPair;
    },
    {}
  );
}
