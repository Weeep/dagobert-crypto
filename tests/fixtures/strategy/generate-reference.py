"""Manually regenerate candle and indicator fixtures without production code."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal, getcontext
import json
from pathlib import Path


getcontext().prec = 50
D = Decimal
ROOT = Path(__file__).parent
PUBLISHED_WILDER_CLOSES = [
    "44.34", "44.09", "44.15", "43.61", "44.33", "44.83", "45.10", "45.42", "45.84", "46.08",
    "45.89", "46.03", "45.61", "46.28", "46.28", "46.00", "46.03", "46.41", "46.22", "45.64",
    "46.21", "46.25", "45.71", "46.45", "45.78", "45.35", "44.03", "44.18", "44.22", "44.57",
    "43.42", "42.66", "43.13", "41.83", "42.05", "41.61", "42.20", "43.03",
]


def iso(value: datetime) -> str:
    return value.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def closes() -> list[Decimal]:
    values = [D(value) for value in PUBLISHED_WILDER_CLOSES]
    for count, delta in [(32, D("-0.25")), (30, D("0.35")), (10, D("-0.60")),
                         (10, D("0.80")), (10, D("-0.70")), (10, D("1.00"))]:
        for index in range(count):
            values.append(values[-1] + delta + (D(index % 3) - 1) * D("0.03"))
    assert len(values) == 140
    return values


def candles(values: list[Decimal]) -> list[dict]:
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    result = []
    for index, close in enumerate(values):
        open_price = values[index - 1] if index else close
        open_time = start + timedelta(hours=index)
        close_time = open_time + timedelta(hours=1) - timedelta(milliseconds=1)
        result.append({
            "id": f"reference-1h-{index:03d}", "pairSymbol": "REFERENCEUSDC", "interval": "1h",
            "openTime": iso(open_time), "closeTime": iso(close_time), "open": str(open_price),
            "high": str(max(open_price, close) + D("0.20")), "low": str(min(open_price, close) - D("0.20")),
            "close": str(close), "volume": str(D("100") + index),
            "quoteVolume": str((D("100") + index) * close), "trades": 100 + index, "isClosed": True,
            "source": "GOLDEN_FIXTURE", "receivedAt": iso(close_time + timedelta(seconds=1)),
        })
    return result


def ema(values: list[Decimal], period: int) -> list[Decimal | None]:
    output: list[Decimal | None] = []
    current = None
    alpha = D(2) / D(period + 1)
    for index, close in enumerate(values):
        if index < period - 1:
            output.append(None)
        elif index == period - 1:
            current = sum(values[:period], D(0)) / D(period)
            output.append(current)
        else:
            current = close * alpha + current * (D(1) - alpha)  # type: ignore[operator]
            output.append(current)
    return output


def rsi(values: list[Decimal], period: int) -> list[Decimal | None]:
    output: list[Decimal | None] = [None] * len(values)
    gains: list[Decimal] = []
    losses: list[Decimal] = []
    average_gain = average_loss = None
    for index in range(1, len(values)):
        change = values[index] - values[index - 1]
        gains.append(max(change, D(0)))
        losses.append(max(-change, D(0)))
        if index == period:
            average_gain = sum(gains[:period], D(0)) / D(period)
            average_loss = sum(losses[:period], D(0)) / D(period)
        elif index > period:
            average_gain = (average_gain * D(period - 1) + gains[index - 1]) / D(period)  # type: ignore[operator]
            average_loss = (average_loss * D(period - 1) + losses[index - 1]) / D(period)  # type: ignore[operator]
        if index >= period:
            if average_gain == 0 and average_loss == 0:
                output[index] = D(50)
            elif average_loss == 0:
                output[index] = D(100)
            elif average_gain == 0:
                output[index] = D(0)
            else:
                output[index] = D(100) - D(100) / (D(1) + average_gain / average_loss)
    return output


def main() -> None:
    values = closes()
    candle_rows = candles(values)
    candle_document = {
        "fixtureVersion": 1,
        "description": "Phase 3 deterministic reference candles: Wilder worksheet prefix plus documented synthetic extension",
        "symbol": "REFERENCEUSDC", "interval": "1h", "candles": candle_rows,
    }
    (ROOT / "reference-candles.json").write_text(json.dumps(candle_document, indent=2) + "\n")
    series = {}
    for name, values_by_candle in [("rsi14", rsi(values, 14)), ("ema20", ema(values, 20)),
                                   ("ema100", ema(values, 100))]:
        series[name] = [{"candleId": candle_rows[index]["id"],
                         "value": None if value is None else float(value)}
                        for index, value in enumerate(values_by_candle)]
    indicator_document = {
        "fixtureVersion": 1, "referenceCandles": "reference-candles.json",
        "comparison": {"type": "absoluteTolerance", "tolerance": 1e-10}, "series": series,
    }
    (ROOT / "expected-indicators.json").write_text(json.dumps(indicator_document, indent=2) + "\n")


if __name__ == "__main__":
    main()
