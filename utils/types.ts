import { TransactionIf } from "@/app/components/Interfaces";

export type DagobertTransaction = {
  orderId: number;
  pair: string; // SOLUSDC
  incomeUsd: number; //8.03
  date: string; //24. 12. 29.
  side: string; // SELL
  qty: number; // 0.041
  price: number; // 195.94
};

export type TransactionGroup = {
  groupId: string | null;
  pair: string;
  incomeUsd: number;
  qty: number;
  lastTransDateStr: string;
  groupedTrans: {
    orderId: number;
    dateStr: string;
    side: string;
    price: number;
    qty: number;
  }[];
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
