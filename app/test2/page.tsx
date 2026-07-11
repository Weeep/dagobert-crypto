"use client";

import React, { useState, useEffect } from "react";
import CandlestickChart from "../components/CandlestickChart";
import { CandleChartResult } from "binance-api-node";
import { KvPairRepository, ListPairsUseCase } from "@/src/modules/pair";
import { DCandle, TradingAnalysis } from "../lib/TradingAnalysis";
import * as d3 from "d3";

const pairRepository = new KvPairRepository();
const listPairsUseCase = new ListPairsUseCase(pairRepository);

const TestPage: React.FC = () => {
  const [klinesData, setKlinesData] = useState<{
    [key: string]: CandleChartResult[];
  }>({});
  const [info, setInfo] = useState<string>("");
  const [dCandles, setDCandles] = useState<DCandle[]>([]);

  useEffect(() => {
    //fetchKlines(); //await fetchKlines());
    test();
  }, []);

  const test = async (): Promise<void> => {
    const pair = "SOLUSDC";
    const klinesRes = await fetch(
      `/api/binanceapi/klines?symbol=${pair}&interval=1h&limit=200`
    );
    const data: DCandle[] = (await klinesRes.json()) as DCandle[];

    const priceRes = await fetch(
      `/api/binanceapi/tickerPrice?symbols=${JSON.stringify(pair)}`
    );
    const currPrice = (await priceRes.json())[0].price;

    // const a1 = data.slice(-6, -1);
    // const a2 = data.slice(-7, -2);
    // const a3 = data.slice(-8, -3);

    // console.log(a1);
    // console.log(a2);
    // console.log(a3);

    const ta = new TradingAnalysis(data, currPrice);

    const newDCandles: DCandle[] = ta.extend();
    setDCandles(newDCandles.slice(-25));

    const rsi1 = ta.getRsi(6);

    setInfo(`${rsi1}`);

    console.log(newDCandles[newDCandles.length - 1]);

    // setInfo(
    //   `RSI(6): ${ta.getRsi(6) ?? -1}\nEMA(7): ${ta.getEma(
    //     7
    //   )}\nEMA(25): ${ta.getEma(25)}\nEMA(100): ${ta.getEma(
    //     100
    //   )}\ndiff to EMA% (100): ${ta.getPriceDiffPercentageToEma(237.02, 100)}`
    // );

    setKlinesData((prev) => {
      return { ...prev, [pair]: data };
    });
  };

  const fetchKlines = async (): Promise<void> => {
    const pairs = await listPairsUseCase.execute();
    for (const pair of pairs.map((dagobertPair) => dagobertPair.pair)) {
      const response = await fetch(
        `/api/binanceapi/klines?symbol=${pair}&interval=1h&limit=24`
        // ["ADAUSDT","ARBUSDT","AVAXUSDT","BNBUSDT","BTCUSDT","DOTUSDT","ETHUSDT","ICPUSDT","MATICUSDT","SHIBUSDT","SOLUSDT","TRXUSDT","XRPUSDT"]
      );

      const data: CandleChartResult[] =
        (await response.json()) as CandleChartResult[];
      if (response.status !== 200 || !Array.isArray(data)) {
        //throw response.status + "-" + JSON.stringify(rjson);
        console.error(
          "error: " + response.status + " | " + JSON.stringify(data)
        );
      }

      setKlinesData((prev) => {
        return { ...prev, [pair]: data };
      }); //Promise<CandleChartResult[]>

      //setIsPairOpen((prev) => {
      //  return { ...prev, [tg.pair]: { isOpen: false } };
      //});

      //return data;
      //return <CandlestickChart data={data} />;
    }

    console.log(JSON.stringify(klinesData));
  };

  return (
    <>
      <div>
        <div className="mt-4 flex justify-evenly w-full">
          <div>Open Time</div>
          <div>RSI6</div>
          <div>EMA7</div>
          <div>EMA7DIFF</div>
          <div>EMA7DIFFPCT</div>
          <div>EMA25</div>
          <div>EMA25DIFF</div>
          <div>EMA25DIFFPCT</div>
          <div>EMA100</div>
          <div>EMA100DIFF</div>
          <div>EMA100DIFFPCT</div>
        </div>
        {dCandles.map((dcandle) => (
          <div
            key={dcandle.openTime}
            className="mt-4 flex justify-evenly w-full"
          >
            <div>
              {d3.timeFormat("%Y-%m-%d %H:%M")(new Date(dcandle.openTime))}
            </div>
            <div>{dcandle.rsi6?.toFixed(2)}</div>
            <div>{dcandle.ema7?.toFixed(2)}</div>
            <div>{dcandle.ema7Diff?.toFixed(2)}</div>
            <div>{dcandle.ema7DiffPct?.toFixed(2)}</div>
            <div>{dcandle.ema25?.toFixed(2)}</div>
            <div>{dcandle.ema25Diff?.toFixed(2)}</div>
            <div>{dcandle.ema25DiffPct?.toFixed(2)}</div>
            <div>{dcandle.ema100?.toFixed(2)}</div>
            <div>{dcandle.ema100Diff?.toFixed(2)}</div>
            <div>{dcandle.ema100DiffPct?.toFixed(2)}</div>
          </div>
        ))}

        <div
          className="text-3xl ml-10 mt-12 mb-4"
          style={{ whiteSpace: "pre-line" }}
        >
          {info}
        </div>
      </div>

      {Object.keys(klinesData).map((key) => {
        return (
          <div key={key}>
            <div className="text-3xl ml-10 mt-12 mb-4">{key}</div>
            <CandlestickChart data={klinesData[key]} />
          </div>
        );
      })}
    </>
  );
};

export default TestPage;

/*
      [
        {
          openTime: 1737637200000,
          open: "242.89000000",
          high: "247.60000000",
          low: "242.04000000",
          close: "246.68000000",
          volume: "28406.22300000",
          closeTime: 1737640799999,
          quoteVolume: "6945015.68943000",
          trades: 14537,
          baseAssetVolume: "16192.04500000",
          quoteAssetVolume: "3958279.78063000",
        },
        {
          openTime: 1737640800000,
          open: "246.65000000",
          high: "254.72000000",
          low: "244.89000000",
          close: "251.48000000",
          volume: "72496.06300000",
          closeTime: 1737644399999,
          quoteVolume: "18149438.14172000",
          trades: 25566,
          baseAssetVolume: "35302.42500000",
          quoteAssetVolume: "8822783.84559000",
        },
        {
          openTime: 1737644400000,
          open: "251.45000000",
          high: "252.86000000",
          low: "244.53000000",
          close: "249.25000000",
          volume: "54296.70000000",
          closeTime: 1737647999999,
          quoteVolume: "13476422.59995000",
          trades: 26292,
          baseAssetVolume: "23705.05700000",
          quoteAssetVolume: "5883640.02841000",
        },
        {
          openTime: 1737648000000,
          open: "249.44000000",
          high: "256.38000000",
          low: "249.15000000",
          close: "250.36000000",
          volume: "37537.34000000",
          closeTime: 1737651599999,
          quoteVolume: "9497264.23669000",
          trades: 16305,
          baseAssetVolume: "17094.08900000",
          quoteAssetVolume: "4325854.64107000",
        },
        {
          openTime: 1737651600000,
          open: "250.33000000",
          high: "250.40000000",
          low: "248.04000000",
          close: "248.10000000",
          volume: "2608.78000000",
          closeTime: 1737655199999,
          quoteVolume: "649319.70800000",
          trades: 1166,
          baseAssetVolume: "613.85300000",
          quoteAssetVolume: "152808.87154000",
        },
      ]
*/
