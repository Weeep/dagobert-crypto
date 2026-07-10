import type { TransactionIf } from "@/app/lib/Interfaces";

export interface ExchangeGateway {
  fetchAllOrders(symbol: string): Promise<TransactionIf[]>;
}
