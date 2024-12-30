import { TransactionIf } from "@/app/components/Interfaces";

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
