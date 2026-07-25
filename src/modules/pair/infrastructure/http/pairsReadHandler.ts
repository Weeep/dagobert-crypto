import type { NextApiRequest, NextApiResponse } from "next";
import type { DagobertPair } from "../../domain/DagobertPair";
import { fromPairDto, toPairDto, type PairDto } from "../../dto/PairDto";
import type { PairRepository } from "../../domain/PairRepository";
import type { ReadApiResponse } from "@/src/shared/dto/ReadApiResponse";
import {
  getSingleQueryValue,
  rejectNonGetMethod,
  sendReadApiError,
} from "@/src/shared/infrastructure/http/readApiHelpers";
import {
  isRecord,
  rejectUnsupportedMethod,
  sendBadRequest,
} from "@/src/shared/infrastructure/http/writeApiHelpers";

export type PairsReadUseCases = {
  listPairs: { execute(): Promise<DagobertPair[]> };
  getPair: {
    execute(symbol: string): Promise<
      | { ok: true; pair: DagobertPair }
      | { ok: false; error: string; pair: null }
    >;
  };
};

export function createPairsReadHandler(
  useCases: PairsReadUseCases,
  repository?: Pick<PairRepository, "save" | "delete">
) {
  return async function pairsReadHandler(
    req: NextApiRequest,
    res: NextApiResponse<ReadApiResponse<PairDto | PairDto[] | null>>
  ): Promise<void> {
    if (!repository && req.method !== "GET") {
      rejectNonGetMethod(res);
      return;
    }

    if (repository && !["GET", "PUT", "DELETE"].includes(req.method ?? "")) {
      rejectUnsupportedMethod(res, ["GET", "PUT", "DELETE"]);
      return;
    }

    try {
      const symbol = getSingleQueryValue(req.query.symbol);
      if (req.method === "PUT") {
        if (!symbol || !isPairDto(req.body) || req.body.pair.trim().toUpperCase() !== symbol.toUpperCase()) {
          sendBadRequest(res, "A valid pair matching the URL symbol is required");
          return;
        }
        await repository!.save(fromPairDto(req.body));
        res.status(200).json({ data: toPairDto(fromPairDto(req.body)) });
        return;
      }
      if (req.method === "DELETE") {
        if (!symbol) {
          sendBadRequest(res, "Pair symbol is required");
          return;
        }
        await repository!.delete(symbol);
        res.status(200).json({ data: null });
        return;
      }
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
      sendReadApiError(
        res,
        500,
        "INTERNAL_ERROR",
        req.method === "GET" ? "Failed to read pairs" : "Failed to write pairs"
      );
    }
  };
}

function isPairDto(value: unknown): value is PairDto {
  return isRecord(value) && typeof value.pair === "string" &&
    typeof value.decimals === "number" && Array.isArray(value.keyLevels) &&
    value.keyLevels.every((level) => typeof level === "number");
}
