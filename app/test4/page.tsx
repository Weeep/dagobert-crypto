"use client";
import { useEffect, useState } from "react";
import { TradingAnalysis } from "../lib/TradingAnalysis";

export default function Chat() {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const pair = "ARBUSDC";
  const interval = "1h";

  const handleSubmit = async () => {
    const res = await fetch("/api/openai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();
    setResponse(data.message);
  };

  useEffect(() => {
    const a = async () => {
      const klinesResponse = await fetch(
        `/api/binanceapi/klines?symbol=${pair}&interval=${interval}&limit=103`
      );
      const candles = await klinesResponse.json();

      const priceResponse = await fetch(
        `/api/binanceapi/tickerPrice?symbols=["${pair}"]`
      );

      const priceJson: { symbol: string; price: string }[] =
        await priceResponse.json();
      if (priceResponse.status !== 200 || !Array.isArray(priceJson)) {
        throw priceResponse.status + "-" + JSON.stringify(priceJson);
      }

      const currentPrice: number = new Number(priceJson[0]["price"]) as number;

      const ta = new TradingAnalysis(candles, currentPrice);
      const minMax = ta.getMinMax(30);

      // const ema7DiffPct = ta.getEma(7).emaDiffPct ?? -400;
      // const ema25DiffPct = ta.getEma(25).emaDiffPct ?? -400;
      // const ema100DiffPct = ta.getEma(100).emaDiffPct ?? -400;
      // const pairEmaRsi: Indicators = {
      //   rsi6: ta.getRsi(6) ?? -1,

      setPrompt(
        `You are a trading analyst. 
        Analyze the following candlestick data (open, high, low, close, volume, time) as well as indicators like RSI, EMA levels, and support/resistance. 
        Consider both short-term momentum and the last 50 candles's patterns. 
        In your response: 
          - Do not explain your reasoning. 
          - Output must always follow this exact structure: 
            1. Main action: BUY or HOLD or SELL 
            2. Secondary statement: BUY or SELL, ~[certainty]%, take profit at [level] 
            3. When to do the opposite option 
        
        Here is the data: 
        Current price: ${currentPrice} 
        Candlesticks in json format: ${JSON.stringify(candles)} 
        
        RSI: ${ta.getRsi(6)?.toFixed(2)} 
        Distance from EMA7 in %: ${
          ta.getEma(7).emaDiffPct?.toFixed(2) ?? "no info"
        } 
        Distance from EMA25 in %: ${
          ta.getEma(25).emaDiffPct?.toFixed(2) ?? "no info"
        } 
        Distance from EMA100 in %: ${
          ta.getEma(100).emaDiffPct?.toFixed(2) ?? "no info"
        } 
        Distance from the bottom of the 30 candles in %: ${minMax.currentPriceMinDiffPct?.toFixed(
          2
        )} 
        Distance from the top of the 30 candles in %: ${minMax.currentPriceMaxDiffPct?.toFixed(
          2
        )}   
        `
      );
    };
    a();
  }, []);

  return (
    <div>
      <textarea
        className="text-black bg-white border p-2"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Írd be a kérdésed..."
      />
      <button onClick={handleSubmit}>Küldés</button>
      <div>{response}</div>
    </div>
  );
}
