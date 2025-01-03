import { TransactionIf } from "@/app/components/Interfaces";

export type DagobertTransaction = {
  orderId: string;
  pair: string; // SOLUSDC
  amount: number; //incomeUsd 8.03
  executed: number; //qty 0.041
  date: Date; //24. 12. 29.
  dateEpoch: number;
  side: string; // SELL
  price: number; // 195.94
  status: string; //FILLED
  grouped: boolean;
};

export type DagobertTransactionGroup = {
  groupId: string | null;
  pair: string;
  amount: number; //incomeUsd
  executed: number; //qty
  lastTransDateEpoch: number;
  groupedTrans: DagobertTransaction[];
};

export type ApiResponse = {
  ok: boolean;
  code: number;
  response: any;
  error: any;
};

export type TransactionsApiResponse = {
  transactions: TransactionIf[] | null;
  apiResponse: ApiResponse;
};
