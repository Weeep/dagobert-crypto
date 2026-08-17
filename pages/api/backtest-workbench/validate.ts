import type { NextApiRequest, NextApiResponse } from "next";
import { authenticatedUserId, bodyRecord } from "@/src/modules/bot/infrastructure/http/botApiHelpers";
import { isMarketInterval, MARKET_INTERVAL_MILLISECONDS } from "@/src/modules/market";
import { postgresRepositories } from "@/src/shared/composition/serverUseCases";

type CandleReader = Pick<typeof postgresRepositories.candleRepository, "findRange">;
type RequestedRow = { id: string; pairSymbol: string; timeframe: string };

export const createWorkbenchValidationHandler = (
  candles: CandleReader = postgresRepositories.candleRepository,
  authenticate: typeof authenticatedUserId = authenticatedUserId,
) => async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" } });
  }
  if (!await authenticate(req, res)) return;
  const body = bodyRecord(req.body);
  const rows = body?.rows;
  const from = typeof body?.from === "string" ? new Date(body.from) : new Date(NaN);
  const to = typeof body?.to === "string" ? new Date(body.to) : new Date(NaN);
  if (!Array.isArray(rows) || !Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from > to)
    return res.status(400).json({ error: { code: "BAD_REQUEST", message: "Rows and a valid ascending date range are required" } });

  const results = await Promise.all(rows.map(async (raw): Promise<object> => {
    const row = raw as Partial<RequestedRow>;
    const timeframe = row.timeframe;
    if (typeof row.id !== "string" || typeof row.pairSymbol !== "string" ||
      typeof timeframe !== "string" || !isMarketInterval(timeframe))
      return { id: typeof row.id === "string" ? row.id : "", valid: false, firstCandle: false, lastCandle: false,
        message: "Select a market pair and timeframe." };
    const interval = MARKET_INTERVAL_MILLISECONDS[timeframe];
    const expectedFirst = new Date(Math.ceil(from.getTime() / interval) * interval);
    const expectedLast = new Date(Math.floor(to.getTime() / interval) * interval);
    const boundaryCandles = await candles.findRange(row.pairSymbol, timeframe, expectedFirst, expectedLast);
    const firstCandle = boundaryCandles[0]?.openTime.getTime() === expectedFirst.getTime();
    const lastCandle = boundaryCandles.at(-1)?.openTime.getTime() === expectedLast.getTime();
    return { id: row.id, valid: firstCandle && lastCandle, firstCandle, lastCandle,
      expectedFirst: expectedFirst.toISOString(), expectedLast: expectedLast.toISOString(),
      message: firstCandle && lastCandle ? "Both boundary candles are available." :
        `${firstCandle ? "First candle found" : "First candle missing"}; ${lastCandle ? "last candle found" : "last candle missing"}.` };
  }));
  return res.status(200).json({ results });
};

export default createWorkbenchValidationHandler();
