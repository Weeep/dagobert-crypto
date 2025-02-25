import { faChevronRight } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useState, useEffect, ReactElement } from "react";
import { DCandle, TradingAnalysis } from "../lib/TradingAnalysis";

type Indicators = {
  ema100: number;
  rsi6: number;
  min: number;
  max: number;
  diffPctMin: number;
  diffPctMax: number;
};

interface Props {
  pair: string;
  price: number;
  className: string;
}

const DIndicator: React.FC<Props> = ({ pair, price, className }) => {
  const [emaRsis1h, setEmaRsis1h] = useState<{ [key: string]: Indicators }>({});
  const [emaRsis1hColor, setEmaRsis1hColor] = useState<{
    [key: string]: { ema100: string; rsi6: string };
  }>({});
  const [emaRsis1d, setEmaRsis1d] = useState<{ [key: string]: Indicators }>({});
  const [emaRsis1dColor, setEmaRsis1dColor] = useState<{
    [key: string]: { ema100: string; rsi6: string };
  }>({});

  useEffect(() => {
    fetchEmaRsi("1h", pair, price);
    fetchEmaRsi("1d", pair, price);
  }, []);

  const fetchEmaRsi = async (interval: string, pair: string, price: number) => {
    const response = await fetch(
      `/api/binanceapi/klines?symbol=${pair}&interval=${interval}&limit=111`
    );

    const data: DCandle[] = (await response.json()) as DCandle[];
    if (response.status !== 200 || !Array.isArray(data)) {
      console.error("error: " + response.status + " | " + JSON.stringify(data)); //TODO
      //price.rsi6 = -1; //TODO ??
      //price.ema100DiffPct = -200; //TODO ??
    } else {
      const ta = new TradingAnalysis(data, price);
      const minMax = ta.getMinMax(30);
      const pairEmaRsi: Indicators = {
        rsi6: ta.getRsi(6) ?? -1,
        ema100: ta.getEma(100).emaDiffPct ?? -202,
        min: minMax.min,
        max: minMax.max,
        diffPctMin: minMax.currentPriceMinDiffPct,
        diffPctMax: minMax.currentPriceMaxDiffPct,
      };
      const pairEmaRsiColor = {
        rsi6: getRsiColor(ta.getRsi(6) ?? 0),
        ema100: getEmaColor(ta.getEma(100).emaDiffPct ?? 0),
      };
      switch (interval) {
        case "1h":
          setEmaRsis1h((prev) => ({
            ...prev,
            [pair]: pairEmaRsi,
          }));
          setEmaRsis1hColor((prev) => ({
            ...prev,
            [pair]: pairEmaRsiColor,
          }));
          break;
        case "1d":
          setEmaRsis1d((prev) => ({
            ...prev,
            [pair]: pairEmaRsi,
          }));
          setEmaRsis1dColor((prev) => ({
            ...prev,
            [pair]: pairEmaRsiColor,
          }));
          break;
      }
    }
  };

  function emaRsiElement(
    pair: string,
    interval: string,
    emaRsiData: {
      [key: string]: Indicators;
    },
    emaRsiDataColor: {
      [key: string]: { ema100: string; rsi6: string };
    }
  ): ReactElement {
    const rsiColor = emaRsiDataColor[pair]?.rsi6 ?? "text-gray-700";
    const rsi = emaRsiData[pair]?.rsi6.toFixed(2) ?? "...";
    const emaColor = emaRsiDataColor[pair]?.ema100 ?? "text-gray-700";
    const ema = emaRsiData[pair]?.ema100.toFixed(2) ?? "...";

    const min = emaRsiData[pair]?.min ?? "...";
    const max = emaRsiData[pair]?.max ?? "...";
    const diffMin = emaRsiData[pair]?.diffPctMin.toFixed(2) ?? "...";
    const diffMax = emaRsiData[pair]?.diffPctMax.toFixed(2) ?? "...";

    return (
      <>
        <div className="text-xs flex space-x-1">
          <span>
            {interval} RSI(6): <span className={rsiColor}>{rsi}</span>
          </span>
          <span>
            Ema100: <span className={emaColor}>{ema}</span>
          </span>
        </div>
        <span className="text-xs">
          {min} ({diffMin}%) | {max} ({diffMax}%)
        </span>
      </>
    );
  }

  const getRsiColor = (rsi: number): string => {
    if (rsi > 80) return "text-red-500";
    if (rsi < 20) return "text-lime-500";
    return "";
  };

  const getEmaColor = (ema: number): string => {
    if (ema < 0) return "text-red-500";
    else return "text-lime-500";
  };

  return (
    <div className={className}>
      <label
        className="p-1 flex items-center"
        onClick={(event) => event.stopPropagation()}
      >
        {/*<input
          type="checkbox"
          checked={selectedPairs.includes(pair)}
          onChange={(event) => handleCheckboxChange(pair, event)}
          className="form-checkbox h-5 w-5 mr-1 text-indigo-600"
        />*/}
        {pair} ${price}
      </label>
      {emaRsiElement(pair, "1h", emaRsis1h, emaRsis1hColor)}
      {emaRsiElement(pair, "1d", emaRsis1d, emaRsis1dColor)}
    </div>
  );
};

export default DIndicator;
