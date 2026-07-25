import type { NextApiRequest, NextApiResponse } from "next";
import { TradeType } from "../../domain/TradeType";
import type { TransactionRepository } from "../../domain/TransactionRepository";
import type { ReadApiResponse } from "@/src/shared/dto/ReadApiResponse";
import { getSingleQueryValue, sendReadApiError } from "@/src/shared/infrastructure/http/readApiHelpers";
import { isRecord, rejectUnsupportedMethod, sendBadRequest } from "@/src/shared/infrastructure/http/writeApiHelpers";

type EpochRepository = Pick<
  TransactionRepository,
  "getLastProcessedEpoch" | "setLastProcessedEpoch"
>;

export function createTransactionEpochHandler(repository: EpochRepository) {
  return async function transactionEpochHandler(
    req: NextApiRequest,
    res: NextApiResponse<ReadApiResponse<number | null>>
  ): Promise<void> {
    if (!["GET", "PUT"].includes(req.method ?? "")) {
      rejectUnsupportedMethod(res, ["GET", "PUT"]);
      return;
    }
    try {
      if (req.method === "GET") {
        const pair = getSingleQueryValue(req.query.pair);
        const tradeType = getSingleQueryValue(req.query.tradeType);
        if (!pair || !isTradeType(tradeType)) {
          sendBadRequest(res, "Valid pair and tradeType query parameters are required");
          return;
        }
        res.status(200).json({ data: await repository.getLastProcessedEpoch(pair, tradeType) });
        return;
      }
      if (!isRecord(req.body) || typeof req.body.pair !== "string" ||
        !isTradeType(req.body.tradeType) || typeof req.body.epoch !== "number") {
        sendBadRequest(res, "Valid pair, tradeType and epoch values are required");
        return;
      }
      await repository.setLastProcessedEpoch(req.body.pair, req.body.tradeType, req.body.epoch);
      res.status(200).json({ data: null });
    } catch {
      sendReadApiError(res, 500, "INTERNAL_ERROR", "Failed to access transaction epoch");
    }
  };
}

function isTradeType(value: unknown): value is TradeType {
  return typeof value === "string" && Object.values(TradeType).includes(value as TradeType);
}
