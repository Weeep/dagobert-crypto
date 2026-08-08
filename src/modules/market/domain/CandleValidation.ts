import Big from "big.js";
import type { Candle } from "./Candle";
import { isMarketInterval, MARKET_INTERVAL_MILLISECONDS } from "./Candle";

export class CandleValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CandleValidationError";
  }
}

function decimal(value: string, field: string): Big {
  try {
    const parsed = new Big(value);
    if (parsed.lt(0)) throw new CandleValidationError(`${field} must be non-negative`);
    return parsed;
  } catch (error) {
    if (error instanceof CandleValidationError) throw error;
    throw new CandleValidationError(`${field} must be a finite decimal string`);
  }
}

export function validateCandle(candle: Candle, requireClosed = false): void {
  if (!/^[A-Z0-9]+USDC$/.test(candle.pairSymbol))
    throw new CandleValidationError("pairSymbol must be an uppercase USDC pair");
  if (!isMarketInterval(candle.interval))
    throw new CandleValidationError("interval is not supported");
  if (!Number.isInteger(candle.trades) || candle.trades < 0)
    throw new CandleValidationError("trades must be a non-negative integer");
  if (requireClosed && !candle.isClosed)
    throw new CandleValidationError("only closed candles can be persisted");
  if (!candle.source.trim()) throw new CandleValidationError("source is required");
  if (!Number.isFinite(candle.openTime.getTime()) || !Number.isFinite(candle.closeTime.getTime()))
    throw new CandleValidationError("candle timestamps must be valid");

  const expectedCloseTime = candle.openTime.getTime() + MARKET_INTERVAL_MILLISECONDS[candle.interval] - 1;
  if (candle.closeTime.getTime() !== expectedCloseTime)
    throw new CandleValidationError("closeTime does not match the candle interval");

  const open = decimal(candle.open, "open");
  const high = decimal(candle.high, "high");
  const low = decimal(candle.low, "low");
  const close = decimal(candle.close, "close");
  decimal(candle.volume, "volume");
  decimal(candle.quoteVolume, "quoteVolume");
  if (low.gt(open) || low.gt(close) || high.lt(open) || high.lt(close) || low.gt(high))
    throw new CandleValidationError("OHLC values are inconsistent");
}

export function validateClosedCandle(candle: Candle): void {
  validateCandle(candle, true);
}
