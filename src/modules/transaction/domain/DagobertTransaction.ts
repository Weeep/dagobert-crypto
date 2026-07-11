import { TradeStyle } from "./TradeStyle";
import { TradeType } from "./TradeType";

export type DagobertTransaction = {
  orderId: string;
  binanceApiId: number;
  pair: string; // SOLUSDC
  amount: number; //incomeUsd 8.03
  executed: number; //qty 0.041
  date: Date; //24. 12. 29.
  dateEpoch: number;
  side: string; // SELL
  price: number; // 195.94
  status: string; //FILLED
  grouped: boolean;
  note: string;
  otherSideOrderId: string;
  tradeType: TradeType;
  tradeStyle: TradeStyle;
};
