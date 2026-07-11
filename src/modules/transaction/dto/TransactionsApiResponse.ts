import type { TransactionIf } from "@/app/lib/Interfaces";
import type { ApiResponse } from "@/src/shared/dto/ApiResponse";

export type TransactionsApiResponse = {
  transactions: TransactionIf[] | null;
  apiResponse: ApiResponse;
};
