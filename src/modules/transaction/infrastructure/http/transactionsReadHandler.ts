import type { NextApiRequest, NextApiResponse } from "next";
import type { DagobertTransaction } from "../../domain/DagobertTransaction";
import { toTransactionDto, type TransactionDto } from "../../dto/TransactionDto";
import type { ReadApiResponse } from "@/src/shared/dto/ReadApiResponse";
import {
  getSingleQueryValue,
  rejectNonGetMethod,
  sendReadApiError,
} from "@/src/shared/infrastructure/http/readApiHelpers";

export type TransactionsReadUseCases = {
  listTransactions: { execute(): Promise<DagobertTransaction[]> };
  getTransaction: {
    execute(id: string): Promise<
      | { ok: true; transaction: DagobertTransaction }
      | { ok: false; error: string; transaction: null }
    >;
  };
};

export function createTransactionsReadHandler(useCases: TransactionsReadUseCases) {
  return async function transactionsReadHandler(
    req: NextApiRequest,
    res: NextApiResponse<ReadApiResponse<TransactionDto | TransactionDto[]>>
  ): Promise<void> {
    if (req.method !== "GET") {
      rejectNonGetMethod(res);
      return;
    }

    try {
      const id = getSingleQueryValue(req.query.id);
      if (!id) {
        const transactions = await useCases.listTransactions.execute();
        res.status(200).json({ data: transactions.map(toTransactionDto) });
        return;
      }

      const result = await useCases.getTransaction.execute(id);
      if (!result.ok) {
        sendReadApiError(res, 404, "NOT_FOUND", result.error);
        return;
      }

      res.status(200).json({ data: toTransactionDto(result.transaction) });
    } catch {
      sendReadApiError(
        res,
        500,
        "INTERNAL_ERROR",
        "Failed to read transactions"
      );
    }
  };
}
