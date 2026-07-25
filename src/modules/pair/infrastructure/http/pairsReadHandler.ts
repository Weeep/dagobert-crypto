import type { NextApiRequest, NextApiResponse } from "next";
import type { DagobertPair } from "../../domain/DagobertPair";
import { toPairDto, type PairDto } from "../../dto/PairDto";
import type { ReadApiResponse } from "@/src/shared/dto/ReadApiResponse";
import {
  getSingleQueryValue,
  rejectNonGetMethod,
  sendReadApiError,
} from "@/src/shared/infrastructure/http/readApiHelpers";

export type PairsReadUseCases = {
  listPairs: { execute(): Promise<DagobertPair[]> };
  getPair: {
    execute(symbol: string): Promise<
      | { ok: true; pair: DagobertPair }
      | { ok: false; error: string; pair: null }
    >;
  };
};

export function createPairsReadHandler(useCases: PairsReadUseCases) {
  return async function pairsReadHandler(
    req: NextApiRequest,
    res: NextApiResponse<ReadApiResponse<PairDto | PairDto[]>>
  ): Promise<void> {
    if (req.method !== "GET") {
      rejectNonGetMethod(res);
      return;
    }

    try {
      const symbol = getSingleQueryValue(req.query.symbol);
      if (!symbol) {
        const pairs = await useCases.listPairs.execute();
        res.status(200).json({ data: pairs.map(toPairDto) });
        return;
      }

      const result = await useCases.getPair.execute(symbol);
      if (!result.ok) {
        sendReadApiError(res, 404, "NOT_FOUND", result.error);
        return;
      }

      res.status(200).json({ data: toPairDto(result.pair) });
    } catch {
      sendReadApiError(res, 500, "INTERNAL_ERROR", "Failed to read pairs");
    }
  };
}
