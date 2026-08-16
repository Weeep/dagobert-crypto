# Stratégia user guide

Ez a dokumentum a Dagobert kereskedési stratégiáinak felhasználói leírása. Bemutatja a stratégia felépítését, a támogatott conditionöket, azok paramétereit, valamint teljes JSON-példákat ad gyakori belépési és kilépési szabályokra.

## 1. Alapfogalmak

Egy stratégia két conditionfát tartalmaz:

- **`entry`**: ha igaz és nincs elsőbbséget élvező, végrehajtható exit, a stratégia `BUY` döntést adhat;
- **`exit`**: nyitott pozíciónként kerül kiértékelésre; ha egy lotra igaz, az a lot eladható. A végrehajtható exit elsőbbséget élvez az entryvel szemben.

A conditionök kizárólag **lezárt gyertyákat** használnak. A kiértékelt gyertya mindig a history utolsó gyertyája, a backtest pedig nem használ jövőbeli adatot. A rendszer jelenlegi strategy schema verziója `1`.

Minimális stratégia:

```json
{
  "schemaVersion": 1,
  "name": "Egyszerű RSI stratégia",
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

> A példák JSON formátumúak: megjegyzés, trailing comma, `NaN` és `Infinity` nem használható bennük.

## 2. Conditionök összekapcsolása

### `all` – minden feltétel teljesüljön

Az `all` akkor igaz, ha minden gyermeke igaz. Legalább egy child condition kötelező.

```json
{
  "all": [
    { "indicator": "RSI", "period": 14, "operator": "LT", "value": 25 },
    { "indicator": "EMA_DISTANCE", "period": 100, "position": "ABOVE" }
  ]
}
```

### `any` – legalább egy feltétel teljesüljön

Az `any` akkor igaz, ha legalább egy gyermeke igaz. Legalább egy child condition kötelező.

```json
{
  "any": [
    { "indicator": "POSITION_RETURN_PCT", "operator": "GTE", "value": 3 },
    { "indicator": "POSITION_RETURN_PCT", "operator": "LTE", "value": -2 }
  ]
}
```

Az `all` és az `any` egymásba ágyazható. A maximális conditionmélység 10, a teljes fában legfeljebb 100 condition lehet.

## 3. Összehasonlító operátorok

Az RSI és a pozícióhozam condition az alábbi operátorokat támogatja:

| Operátor | Jelentés |
| --- | --- |
| `LT` | kisebb (`<`) |
| `LTE` | kisebb vagy egyenlő (`<=`) |
| `GT` | nagyobb (`>`) |
| `GTE` | nagyobb vagy egyenlő (`>=`) |

## 4. Támogatott conditionök

### 4.1. `RSI`

A Wilder-féle Relative Strength Index legutolsó értékét hasonlítja egy küszöbhöz.

```json
{
  "indicator": "RSI",
  "period": 14,
  "operator": "LT",
  "value": 20
}
```

| Paraméter | Típus | Megkötés | Jelentés |
| --- | --- | --- | --- |
| `indicator` | string | mindig `RSI` | Condition típusa. |
| `period` | integer | pozitív | RSI periódus. |
| `operator` | string | `LT`, `LTE`, `GT`, `GTE` | Összehasonlítás. |
| `value` | number | 0–100 | RSI küszöb. |

Az RSI legalább `period + 1` lezárt gyertyát igényel. Például az RSI14 warm-upja 15 gyertya. Ha nincs elegendő history, a condition nem matchel, és `INSUFFICIENT_HISTORY` eredményt ad.

### 4.2. `EMA_DISTANCE`

Azt vizsgálja, hogy a legutóbbi close szigorúan az EMA fölött vagy alatt van-e. Opcionálisan a close és az EMA közötti maximális százalékos távolság is korlátozható.

```json
{
  "indicator": "EMA_DISTANCE",
  "period": 100,
  "position": "ABOVE",
  "maximumDistancePct": 2.0
}
```

| Paraméter | Típus | Megkötés | Jelentés |
| --- | --- | --- | --- |
| `indicator` | string | mindig `EMA_DISTANCE` | Condition típusa. |
| `period` | integer | pozitív | EMA periódus. |
| `position` | string | `ABOVE` vagy `BELOW` | A close elvárt oldala. |
| `maximumDistancePct` | number | opcionális, 0–100, legfeljebb 1 tizedes | Maximális abszolút távolság az EMA-tól százalékban. |

Az egyenlőség egyik irányban sem match: `ABOVE` esetén `close > EMA`, `BELOW` esetén `close < EMA`. A distance limit elhagyásával bármilyen távolság elfogadott. A condition legalább `period` gyertyát igényel.

Ez egy **szint-condition**: amíg az ár a kiválasztott oldalon marad, több egymást követő gyertyán is igaz lehet. Egyszeri crossing jelzéshez az `EMA_CROSS_CONFIRMATION` használata javasolt.

### 4.3. `EMA_CROSS_CONFIRMATION`

Megerősített EMA-kereszteződést jelez. A kereszteződés után megadott számú egymást követő close-nak szigorúan az EMA új oldalán kell lennie, az ezeket közvetlenül megelőző close pedig az ellenkező oldalon vagy pontosan az EMA-n áll.

BUY példa: három gyertyával megerősített EMA100 fölé kerülés:

```json
{
  "indicator": "EMA_CROSS_CONFIRMATION",
  "period": 100,
  "direction": "ABOVE",
  "confirmationCandles": 3
}
```

Ennek jelentése:

```text
close(t-3) <= EMA100(t-3)
close(t-2) >  EMA100(t-2)
close(t-1) >  EMA100(t-1)
close(t)   >  EMA100(t)
```

SELL példa: három gyertyával megerősített EMA100 alá kerülés:

```json
{
  "indicator": "EMA_CROSS_CONFIRMATION",
  "period": 100,
  "direction": "BELOW",
  "confirmationCandles": 3
}
```

Ennek jelentése:

```text
close(t-3) >= EMA100(t-3)
close(t-2) <  EMA100(t-2)
close(t-1) <  EMA100(t-1)
close(t)   <  EMA100(t)
```

| Paraméter | Típus | Megkötés | Jelentés |
| --- | --- | --- | --- |
| `indicator` | string | mindig `EMA_CROSS_CONFIRMATION` | Condition típusa. |
| `period` | integer | pozitív | EMA periódus. |
| `direction` | string | `ABOVE` vagy `BELOW` | A kereszteződés iránya. |
| `confirmationCandles` | integer | pozitív | Az új oldalon záró egymást követő gyertyák száma. |

Minden close a **saját időpontjához tartozó EMA-val** kerül összehasonlításra. Az evaluator a szükséges, rögzített hosszúságú trailing ablakból számolja az EMA-kat, ezért ugyanaz a candle és stratégia live futásban és backtestben is azonos eredményt ad.

A szükséges history `period + confirmationCandles`. EMA100 és 3 confirmation esetén ez 103 lezárt gyertya. A condition természeténél fogva one-shot: a következő gyertyán a megerősítő sorozat előtti gyertya már nem lesz az ellenkező oldalon, ezért a szabály nem jelez folyamatosan minden EMA fölötti vagy alatti gyertyán.

### 4.4. `candleSequence`

A legutóbbi egymást követő gyertyák színét és minimum body változását vizsgálja.

```json
{
  "candleSequence": {
    "count": 3,
    "direction": "RED",
    "minimumBodyChangePct": 1.0
  }
}
```

| Paraméter | Típus | Megkötés | Jelentés |
| --- | --- | --- | --- |
| `count` | integer | pozitív | Vizsgált utolsó gyertyák száma. |
| `direction` | string | `RED`, `GREEN`, `DOJI` | Minden gyertya elvárt iránya. |
| `minimumBodyChangePct` | number | nem negatív | Gyertyánként elvárt minimum abszolút body változás százalékban. |

A `RED` gyertya close-a az open alatt, a `GREEN` close-a az open fölött van, a `DOJI` close-a megegyezik az opennel. A condition `count` lezárt gyertyát igényel.

### 4.5. `POSITION_RETURN_PCT`

Egy nyitott pozíció becsült nettó százalékos hozamát hasonlítja a küszöbhöz. **Csak az `exit` conditionfában használható.**

Take-profit:

```json
{
  "indicator": "POSITION_RETURN_PCT",
  "operator": "GTE",
  "value": 3
}
```

Stop-loss:

```json
{
  "indicator": "POSITION_RETURN_PCT",
  "operator": "LTE",
  "value": -2
}
```

| Paraméter | Típus | Megkötés | Jelentés |
| --- | --- | --- | --- |
| `indicator` | string | mindig `POSITION_RETURN_PCT` | Condition típusa. |
| `operator` | string | `LT`, `LTE`, `GT`, `GTE` | Összehasonlítás. |
| `value` | number | véges, előjeles szám | Nettó hozamküszöb százalékban. |

A számítás figyelembe veszi a fee-inclusive bekerülési költséget, az entry fee-t és a jelenlegi close alapján becsült exit fee-t:

```text
entryOutflow = entryCost + entryFees
grossExitValue = quantity * currentClose
estimatedExitFee = grossExitValue * exitFeeRate
netExitProceeds = grossExitValue - estimatedExitFee
netReturnPct = (netExitProceeds - entryOutflow) / entryOutflow * 100
```

Minden nyitott lot külön kerül kiértékelésre. Emiatt egyszerre csak azok a pozíciók kerülnek kiválasztásra eladásra, amelyekre az exitfa matchel.

## 5. Entry trigger policy

Az opcionális `entryPolicy` szabályozza, hogy egy igaz entry condition mikor nyithat új pozíciót.

```json
{
  "entryPolicy": {
    "trigger": "ON_FALSE_TO_TRUE",
    "cooldownCandles": 12
  }
}
```

| Paraméter | Típus | Megkötés | Jelentés |
| --- | --- | --- | --- |
| `trigger` | string | `EVERY_MATCHING_CANDLE` vagy `ON_FALSE_TO_TRUE` | Entry trigger mód. |
| `cooldownCandles` | integer | opcionális, nem negatív | Sikeres entry fill után kihagyandó close-kiértékelések száma. |

- **`EVERY_MATCHING_CANDLE`**: minden matchelő gyertya új entry intentet hozhat létre, ha a budget- és pozíciószabályok engedik.
- **`ON_FALSE_TO_TRUE`**: csak a condition false → true élén enged entryt; új jelzéshez előbb legalább egy nem matchelő gyertya szükséges.
- **`cooldownCandles`**: a trigger módtól függetlenül további védelmet ad a túl sűrű belépések ellen.

Az `EMA_CROSS_CONFIRMATION` eleve one-shot, ezért ennél az `EVERY_MATCHING_CANDLE` sem okoz folyamatos EMA-oldali vásárlást. Vegyes vagy szint-conditionöket tartalmazó entryknél az `ON_FALSE_TO_TRUE` továbbra is hasznos.

## 6. Teljes stratégia példák

### 6.1. Három gyertyával megerősített EMA100 crossing

Az alábbi stratégia akkor vásárol, amikor három egymást követő candle EMA100 fölött zárt, miközben az előttük lévő még az EMA100 alatt vagy azon zárt. Az eladás ennek tükörképe.

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

### 6.2. EMA crossing RSI szűrővel és fee-aware TP/SL exittel

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

### 6.3. RSI és EMA-distance belépő

```json
{
  "schemaVersion": 1,
  "name": "RSI dip above EMA100",
  "entry": {
    "all": [
      { "indicator": "RSI", "period": 14, "operator": "LT", "value": 25 },
      {
        "indicator": "EMA_DISTANCE",
        "period": 100,
        "position": "ABOVE",
        "maximumDistancePct": 2.0
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

## 7. Kiértékelési és warm-up szabályok

A rendszer a teljes conditionfához annyi historyt kér, amennyit annak legnagyobb igényű ága megkövetel:

| Condition | Szükséges lezárt gyertya |
| --- | --- |
| `RSI` | `period + 1` |
| `EMA_DISTANCE` | `period` |
| `EMA_CROSS_CONFIRMATION` | `period + confirmationCandles` |
| `candleSequence` | `count` |
| `POSITION_RETURN_PCT` | 1, plusz nyitott pozíció és fee context |
| `all` / `any` | a gyermekek maximuma |

Ha nincs elegendő history, az érintett leaf `INSUFFICIENT_HISTORY` eredményt kap és nem matchel. Az `all`/`any` ezt normál false childként kezeli.

## 8. Gyakori hibák

- `POSITION_RETURN_PCT` használata entryben: nem engedélyezett, mert nyitott lot contextet igényel.
- Nulla vagy tört `period`, `confirmationCandles`, `count`: ezek pozitív egész számok.
- `EMA_DISTANCE` esetén `maximumDistancePct: 2.25`: legfeljebb egy tizedesjegy támogatott, használj például `2.2`-t.
- `ABOVE`/`BELOW` esetén egyenlőségre számítani: a megerősítő és distance condition új oldali összehasonlítása szigorú.
- Szint-condition használata trigger policy nélkül: egy több gyertyán át igaz RSI vagy EMA-distance több entryt is eredményezhet. Használj `ON_FALSE_TO_TRUE` triggert vagy cooldown-t.
- Nem lezárt candle alapján várt jelzés: a stratégia csak lezárt gyertyák után értékel.
