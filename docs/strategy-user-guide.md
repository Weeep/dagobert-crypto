# Strategy user guide

This document explains how to configure Dagobert trading strategies. It covers the strategy structure, every supported condition and its parameters, entry-trigger behavior, warm-up requirements, and complete JSON examples.

## 1. Core concepts

A strategy contains two condition trees:

- **`entry`**: when it matches and there is no actionable exit with higher priority, the strategy may produce a `BUY` decision;
- **`exit`**: evaluated separately for each open position lot. A lot can be sold when this tree matches for that lot. An actionable exit takes priority over an entry.

Conditions use **closed candles only**. The evaluated candle is always the last candle in the supplied history, and backtests do not use future data. The current strategy schema version is `1`.

Minimal strategy:

```json
{
  "schemaVersion": 1,
  "name": "Simple RSI strategy",
  "entry": {
    "indicator": "RSI",
    "period": 14,
    "operator": "LT",
    "value": 20
  },
  "exit": {
    "indicator": "RSI",
    "period": 14,
    "operator": "GTE",
    "value": 80
  }
}
```

> All examples are valid JSON. Comments, trailing commas, `NaN`, and `Infinity` are not valid JSON values and cannot be used.

## 2. Combining conditions

### `all` — every condition must match

An `all` group matches only when every child matches. It must contain at least one child condition.

```json
{
  "all": [
    { "indicator": "RSI", "period": 14, "operator": "LT", "value": 25 },
    { "indicator": "EMA_DEVIATION_PCT", "period": 100, "operator": "GT", "value": 0 }
  ]
}
```

### `any` — at least one condition must match

An `any` group matches when one or more children match. It must contain at least one child condition.

```json
{
  "any": [
    { "indicator": "POSITION_RETURN_PCT", "operator": "GTE", "value": 3 },
    { "indicator": "POSITION_RETURN_PCT", "operator": "LTE", "value": -2 }
  ]
}
```

`all` and `any` groups can be nested. A condition tree has a maximum depth of 10 and can contain at most 100 condition nodes in total.

## 3. Comparison operators

RSI, signed EMA-deviation, EMA-slope, and position-return conditions support these operators:

| Operator | Meaning |
| --- | --- |
| `LT` | less than (`<`) |
| `LTE` | less than or equal to (`<=`) |
| `GT` | greater than (`>`) |
| `GTE` | greater than or equal to (`>=`) |

## 4. Supported conditions

### 4.1. `RSI`

Compares the latest Wilder Relative Strength Index value with a threshold.

```json
{
  "indicator": "RSI",
  "period": 14,
  "operator": "LT",
  "value": 20
}
```

| Parameter | Type | Constraint | Meaning |
| --- | --- | --- | --- |
| `indicator` | string | always `RSI` | Condition type. |
| `period` | integer | positive | RSI period. |
| `operator` | string | `LT`, `LTE`, `GT`, `GTE`, `CROSS_ABOVE`, or `CROSS_BELOW` | Comparison or crossing operator. |
| `value` | number | 0–100 | RSI threshold. |

`CROSS_ABOVE` matches when the previous RSI was at or below the threshold and the latest RSI is above it. `CROSS_BELOW` matches when the previous RSI was at or above the threshold and the latest RSI is below it. This makes both crossing operators one-candle events rather than persistent conditions.

Regular RSI comparisons require at least `period + 1` closed candles; crossing operators require one additional candle so both consecutive RSI values are available. For example, RSI14 has a 15-candle comparison warm-up and a 16-candle crossing warm-up. When there is not enough history, the condition does not match and reports `INSUFFICIENT_HISTORY`.

### 4.2. `EMA_DISTANCE`

Checks whether the latest close is strictly above or below the EMA. It can optionally limit the maximum percentage distance between the close and the EMA.

```json
{
  "indicator": "EMA_DISTANCE",
  "period": 100,
  "position": "ABOVE",
  "maximumDistancePct": 2.0
}
```

| Parameter | Type | Constraint | Meaning |
| --- | --- | --- | --- |
| `indicator` | string | always `EMA_DISTANCE` | Condition type. |
| `period` | integer | positive | EMA period. |
| `position` | string | `ABOVE` or `BELOW` | Required side of the EMA. |
| `maximumDistancePct` | number | optional; 0–100, at most one decimal place | Maximum absolute distance from the EMA as a percentage. |

Equality does not match either side: `ABOVE` requires `close > EMA`, and `BELOW` requires `close < EMA`. Omit `maximumDistancePct` to allow any distance. This condition requires at least `period` candles.

This is a **level condition**: it can remain true on multiple consecutive candles while price stays on the selected side. Use `EMA_CROSS_CONFIRMATION` when you need a one-shot crossing signal.

### 4.3. `EMA_DEVIATION_PCT`

Compares the latest close's signed percentage deviation from the EMA:

```text
(close - EMA(period)) / EMA(period) * 100
```

Negative values are below the EMA and positive values are above it. For example, this matches when the close is at least 2% below EMA100 (including exactly -2%):

```json
{
  "indicator": "EMA_DEVIATION_PCT",
  "period": 100,
  "operator": "LTE",
  "value": -2.0
}
```

Use `LT -2` for strictly more than 2% below, `GTE 2` for at least 2% above, and `LT 0` for any close below the EMA. To express the legacy “below EMA but no farther than 2%” rule, combine `LT 0` and `GTE -2` inside an `ALL` group. Supported operators are `LT`, `LTE`, `GT`, and `GTE`; the signed threshold must be finite. This condition requires at least `period` candles.

### 4.4. `EMA_CROSS_CONFIRMATION`

Detects a confirmed EMA crossing. A configured number of consecutive closes must be strictly on the new side of the EMA, and the close immediately before that sequence must be on the opposite side or exactly equal to its EMA.

BUY example: an EMA100 upward crossing confirmed by three candles:

```json
{
  "indicator": "EMA_CROSS_CONFIRMATION",
  "period": 100,
  "direction": "ABOVE",
  "confirmationCandles": 3
}
```

It means:

```text
close(t-3) <= EMA100(t-3)
close(t-2) >  EMA100(t-2)
close(t-1) >  EMA100(t-1)
close(t)   >  EMA100(t)
```

SELL example: an EMA100 downward crossing confirmed by three candles:

```json
{
  "indicator": "EMA_CROSS_CONFIRMATION",
  "period": 100,
  "direction": "BELOW",
  "confirmationCandles": 3
}
```

It means:

```text
close(t-3) >= EMA100(t-3)
close(t-2) <  EMA100(t-2)
close(t-1) <  EMA100(t-1)
close(t)   <  EMA100(t)
```

| Parameter | Type | Constraint | Meaning |
| --- | --- | --- | --- |
| `indicator` | string | always `EMA_CROSS_CONFIRMATION` | Condition type. |
| `period` | integer | positive | EMA period. |
| `direction` | string | `ABOVE` or `BELOW` | Crossing direction. |
| `confirmationCandles` | integer | positive | Number of consecutive closes required on the new side. |

Every close is compared with the EMA value from **that same point in time**. The evaluator calculates those EMA values from a fixed-size trailing window, so the same strategy and candle produce the same result in live evaluation and backtests.

Required history is `period + confirmationCandles`. EMA100 with three confirmation candles therefore needs 103 closed candles. This condition is naturally one-shot: on the next candle, the candle immediately before the confirmation sequence is no longer on the opposite side, so the rule does not keep matching on every candle above or below the EMA.

### 4.5. `candleSequence`

Checks the direction and minimum body change of the latest consecutive candles.

```json
{
  "candleSequence": {
    "count": 3,
    "direction": "RED",
    "minimumBodyChangePct": 1.0
  }
}
```

| Parameter | Type | Constraint | Meaning |
| --- | --- | --- | --- |
| `count` | integer | positive | Number of latest candles to inspect. |
| `direction` | string | `RED`, `GREEN`, or `DOJI` | Required direction of every candle. |
| `minimumBodyChangePct` | number | non-negative | Minimum absolute body change required for each candle, as a percentage. |

A `RED` candle closes below its open, a `GREEN` candle closes above its open, and a `DOJI` closes at its open. This condition requires `count` closed candles.

### 4.6. `POSITION_RETURN_PCT`

Compares the estimated net percentage return of an open position with a threshold. It is supported **only in the `exit` condition tree**.

Take-profit example:

```json
{
  "indicator": "POSITION_RETURN_PCT",
  "operator": "GTE",
  "value": 3
}
```

Stop-loss example:

```json
{
  "indicator": "POSITION_RETURN_PCT",
  "operator": "LTE",
  "value": -2
}
```

| Parameter | Type | Constraint | Meaning |
| --- | --- | --- | --- |
| `indicator` | string | always `POSITION_RETURN_PCT` | Condition type. |
| `operator` | string | `LT`, `LTE`, `GT`, or `GTE` | Comparison operator. |
| `value` | number | any finite signed number | Net return threshold as a percentage. |

The calculation includes fee-inclusive entry outflow, entry fees, and the estimated exit fee based on the current close:

```text
entryOutflow = entryCost + entryFees
grossExitValue = quantity * currentClose
estimatedExitFee = grossExitValue * exitFeeRate
netExitProceeds = grossExitValue - estimatedExitFee
netReturnPct = (netExitProceeds - entryOutflow) / entryOutflow * 100
```

Each open lot is evaluated independently. Only lots for which the exit tree matches are selected for sale.

### 4.6.1. `TRAILING_RETURN_PCT`

This exit-only profit-protection condition tracks each open lot's greatest fee-aware net return on **closed-candle close prices** since that lot opened. It does not use candle highs. Therefore live evaluation and backtesting are deterministic and use the same rules.

```json
{
  "indicator": "TRAILING_RETURN_PCT",
  "activationPct": 5,
  "minimumExitPct": 3,
  "trailingDistancePct": 3
}
```

The condition cannot match until `highestReturnPct >= activationPct`. Once activated, its threshold is `max(minimumExitPct, highestReturnPct - trailingDistancePct)`, and it matches when the current net return is at or below that threshold. For example, after the configuration above reaches 10%, its threshold is 7%; closes at 9% and 8% do not match, while 7% does.

| Parameter | Type | Constraint | Meaning |
| --- | --- | --- | --- |
| `indicator` | string | always `TRAILING_RETURN_PCT` | Condition type. |
| `activationPct` | number | finite | Return that activates trailing. |
| `minimumExitPct` | number | finite and no greater than activation | Floor for the exit threshold. |
| `trailingDistancePct` | number | finite and positive | Distance below the highest return. |

Net return uses the same fee-aware formula as `POSITION_RETURN_PCT`. The maximum is derived per lot from stored closed candles at or after its opening time. No derived trailing state is persisted: a restart reconstructs the same maximum from immutable candle and position history, and a newly opened lot naturally starts with fresh history.

### 4.7. `MARKET_REGIME`

Classifies the market from the strict ordering of three fixed EMAs:

- `BULLISH` when EMA7 > EMA25 > EMA100;
- `BEARISH` when EMA7 < EMA25 < EMA100;
- `SIDEWAYS` for every other ordering, including equal EMA values.

```json
{
  "indicator": "MARKET_REGIME",
  "value": "BULLISH"
}
```

The condition matches when the calculated classification equals `value`. The only supported values are `BULLISH`, `BEARISH`, and `SIDEWAYS`. It requires 100 closed candles.

### 4.8. `EMA_SLOPE`

Compares an EMA's signed percentage change over a candle lookback:

```text
(current EMA(period) - EMA(period) lookbackCandles ago) / EMA(period) lookbackCandles ago * 100
```

For example, this matches when EMA100 rose by at least 0.3% over the last 12 candles:

```json
{
  "indicator": "EMA_SLOPE",
  "period": 100,
  "lookbackCandles": 12,
  "operator": "GTE",
  "value": 0.3
}
```

Both `period` and `lookbackCandles` must be positive integers. `value` is a finite signed percentage, so negative thresholds can describe falling EMAs. The supported operators are `LT`, `LTE`, `GT`, and `GTE`. The condition requires `period + lookbackCandles` closed candles (112 in the example).

## 5. Entry trigger policy

The optional `entryPolicy` controls when a matching entry condition may open a new position.

```json
{
  "entryPolicy": {
    "trigger": "ON_FALSE_TO_TRUE",
    "cooldownCandles": 12
  }
}
```

| Parameter | Type | Constraint | Meaning |
| --- | --- | --- | --- |
| `trigger` | string | `EVERY_MATCHING_CANDLE` or `ON_FALSE_TO_TRUE` | Entry trigger mode. |
| `cooldownCandles` | integer | optional, non-negative | Number of close evaluations suppressed after a successful entry fill. |

- **`EVERY_MATCHING_CANDLE`**: every matching candle can create a new entry intent when budget and position rules allow it.
- **`ON_FALSE_TO_TRUE`**: permits an entry only on the false-to-true edge. At least one non-matching candle is required before the policy can rearm.
- **`cooldownCandles`**: provides additional protection against entries occurring too close together, independently of the trigger mode.

`EMA_CROSS_CONFIRMATION` is already one-shot, so `EVERY_MATCHING_CANDLE` does not cause continuous entries merely because price remains on one side of the EMA. `ON_FALSE_TO_TRUE` is still useful for entry trees that also contain level conditions.

## 6. Complete strategy examples

### 6.1. EMA100 crossing confirmed by three candles

This strategy buys when three consecutive candles have closed above EMA100 and the candle immediately before them closed below or exactly on EMA100. Its exit is the mirrored downward crossing.

```json
{
  "schemaVersion": 1,
  "name": "EMA100 confirmed crossing",
  "entry": {
    "indicator": "EMA_CROSS_CONFIRMATION",
    "period": 100,
    "direction": "ABOVE",
    "confirmationCandles": 3
  },
  "exit": {
    "indicator": "EMA_CROSS_CONFIRMATION",
    "period": 100,
    "direction": "BELOW",
    "confirmationCandles": 3
  },
  "entryPolicy": {
    "trigger": "EVERY_MATCHING_CANDLE"
  }
}
```

### 6.2. EMA crossing with an RSI filter and fee-aware take-profit/stop-loss

```json
{
  "schemaVersion": 1,
  "name": "Confirmed EMA with RSI and TP-SL",
  "entry": {
    "all": [
      {
        "indicator": "EMA_CROSS_CONFIRMATION",
        "period": 100,
        "direction": "ABOVE",
        "confirmationCandles": 3
      },
      {
        "indicator": "RSI",
        "period": 14,
        "operator": "LT",
        "value": 65
      }
    ]
  },
  "exit": {
    "any": [
      {
        "indicator": "EMA_CROSS_CONFIRMATION",
        "period": 100,
        "direction": "BELOW",
        "confirmationCandles": 3
      },
      {
        "indicator": "POSITION_RETURN_PCT",
        "operator": "GTE",
        "value": 4
      },
      {
        "indicator": "POSITION_RETURN_PCT",
        "operator": "LTE",
        "value": -2
      }
    ]
  },
  "entryPolicy": {
    "trigger": "ON_FALSE_TO_TRUE",
    "cooldownCandles": 3
  }
}
```

### 6.3. RSI and EMA-distance entry

```json
{
  "schemaVersion": 1,
  "name": "RSI dip above EMA100",
  "entry": {
    "all": [
      { "indicator": "RSI", "period": 14, "operator": "LT", "value": 25 },
      {
        "indicator": "EMA_DEVIATION_PCT",
        "period": 100,
        "operator": "GT",
        "value": 0
      }
    ]
  },
  "exit": {
    "any": [
      { "indicator": "RSI", "period": 14, "operator": "GTE", "value": 75 },
      { "indicator": "POSITION_RETURN_PCT", "operator": "LTE", "value": -3 }
    ]
  },
  "entryPolicy": {
    "trigger": "ON_FALSE_TO_TRUE"
  }
}
```

## 7. Evaluation and warm-up rules

The system loads enough history for the most demanding branch in the complete condition tree:

| Condition | Required closed candles |
| --- | --- |
| `RSI` | `period + 1` |
| `EMA_DISTANCE` | `period` |
| `EMA_DEVIATION_PCT` | `period` |
| `EMA_CROSS_CONFIRMATION` | `period + confirmationCandles` |
| `MARKET_REGIME` | 100 |
| `EMA_SLOPE` | `period + lookbackCandles` |
| `candleSequence` | `count` |
| `POSITION_RETURN_PCT` | 1, plus an open-position and fee context |
| `TRAILING_RETURN_PCT` | every closed candle since the lot opened, plus position and fee context |
| `all` / `any` | maximum requirement among their children |

When there is not enough history, the affected leaf reports `INSUFFICIENT_HISTORY` and does not match. An `all` or `any` group treats it as a normal non-matching child.

## 8. Common configuration mistakes

- Using `POSITION_RETURN_PCT` in `entry`: it is not supported because it requires an open position-lot context.
- Using `TRAILING_RETURN_PCT` in `entry`, a non-positive trailing distance, or a minimum exit above activation: these configurations are rejected.
- Supplying zero or a fractional `period`, `lookbackCandles`, `confirmationCandles`, or `count`: these values must be positive integers.
- Using `maximumDistancePct: 2.25` with `EMA_DISTANCE`: at most one decimal place is supported; use a value such as `2.2` instead.
- Expecting equality to count as the new `ABOVE` or `BELOW` side: confirmation and distance checks use strict comparisons on the new side.
- Using a level condition without an entry trigger policy: an RSI or EMA-distance condition that remains true for several candles can cause multiple entries. Use `ON_FALSE_TO_TRUE` or a cooldown when that is not desired.
- Expecting a signal from an open candle: strategies are evaluated only after candles close.
