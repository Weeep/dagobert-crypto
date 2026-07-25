import type { NextApiRequest, NextApiResponse } from "next";
import type { DagobertTransaction } from "../../domain/DagobertTransaction";
import { fromTransactionDto, toTransactionDto, type TransactionDto } from "../../dto/TransactionDto";
import type { TransactionRepository } from "../../domain/TransactionRepository";
import type { ReadApiResponse } from "@/src/shared/dto/ReadApiResponse";
import {
  getSingleQueryValue,
  rejectNonGetMethod,
  sendReadApiError,
} from "@/src/shared/infrastructure/http/readApiHelpers";
import { isRecord, rejectUnsupportedMethod, sendBadRequest } from "@/src/shared/infrastructure/http/writeApiHelpers";

export type TransactionsReadUseCases = {
  listTransactions: { execute(): Promise<DagobertTransaction[]> };
  getTransaction: {
    execute(id: string): Promise<
      | { ok: true; transaction: DagobertTransaction }
      | { ok: false; error: string; transaction: null }
    >;
  };
};

export function createTransactionsReadHandler(
  useCases: TransactionsReadUseCases,
  repository?: Pick<TransactionRepository, "save" | "saveMany">
) {
  return async function transactionsReadHandler(
    req: NextApiRequest,
    res: NextApiResponse<ReadApiResponse<TransactionDto | TransactionDto[] | null>>
  ): Promise<void> {
    if (!repository && req.method !== "GET") {
      rejectNonGetMethod(res);
      return;
    }
    if (repository && !["GET", "PUT"].includes(req.method ?? "")) {
      rejectUnsupportedMethod(res, ["GET", "PUT"]);
      return;
    }

    try {
      const id = getSingleQueryValue(req.query.id);
      if (req.method === "PUT") {
        if (id) {
          if (!isTransactionDto(req.body) || req.body.orderId !== id) {
            sendBadRequest(res, "A valid transaction matching the URL id is required");
            return;
          }
          const transaction = fromTransactionDto(req.body);
          await repository!.save(transaction);
          res.status(200).json({ data: toTransactionDto(transaction) });
          return;
        }
        if (!Array.isArray(req.body) || !req.body.every(isTransactionDto)) {
          sendBadRequest(res, "A transaction array is required");
          return;
        }
        await repository!.saveMany(req.body.map(fromTransactionDto));
        res.status(200).json({ data: null });
        return;
      }
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
        req.method === "GET" ? "Failed to read transactions" : "Failed to write transactions"
      );
    }
  };
}

function isTransactionDto(value: unknown): value is TransactionDto {
  return isRecord(value) && typeof value.orderId === "string" &&
    typeof value.pair === "string" && typeof value.date === "string" &&
    typeof value.dateEpoch === "number";
}
