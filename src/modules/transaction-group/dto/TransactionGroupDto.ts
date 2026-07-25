import { toTransactionDto, type TransactionDto } from "@/src/modules/transaction/dto/TransactionDto";
import type { TradeType } from "@/src/modules/transaction";
import type { DagobertTransactionGroup } from "../domain/DagobertTransactionGroup";

/** Stable JSON representation exposed by the transaction-group HTTP API. */
export type TransactionGroupDto = {
  groupId: string | null;
  pair: string;
  amount: number;
  executed: number;
  tradeType: TradeType;
  lastTransDateEpoch: number;
  groupedTrans: TransactionDto[];
  note: string;
};

export function toTransactionGroupDto(
  group: DagobertTransactionGroup
): TransactionGroupDto {
  return {
    ...group,
    groupedTrans: group.groupedTrans.map(toTransactionDto),
  };
}
