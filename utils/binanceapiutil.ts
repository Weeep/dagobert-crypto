const apiKey: string = process.env.BAPI_KEY as string;
const apiSecret: string = process.env.BAPI_SEC as string;

let resultCode: number;
let resultBody: string;

// Binance API doc
// https://binance-docs.github.io/apidocs/spot/en/#symbol-price-ticker

export default async function binanceapiutil(
  apiEndpoint: string,
  params: Record<string, any>,
  createTimestamp: boolean = true,
  createSign: boolean = true
) {
  let tryToFetch = true;
  let msCounter = 0;
  while (tryToFetch && msCounter <= 10) {
    let binanceUrl = `https://api.binance.com/api/v3/${apiEndpoint}`;

    if (createTimestamp) {
      params.timestamp = Math.floor(Date.now() + 5000 - msCounter * 1000);
      msCounter++;
    }

    const query = new URLSearchParams(params).toString();

    if (createSign) {
      const sign = require("crypto")
        .createHmac("sha256", apiSecret)
        .update(query)
        .digest("hex");
      binanceUrl += `?${query}&signature=${sign}`;
    } else {
      binanceUrl += `?${query}`;
    }

    const header: RequestInit = {
      headers: {
        "Content-Type": "application/json",
        "X-MBX-APIKEY": apiKey,
      },
    };

    try {
      const binanceRes = await fetch(binanceUrl, header);
      const transactions = await binanceRes.json();
      tryToFetch = transactions?.code == -1021;

      resultCode = 200;
      resultBody = transactions;
    } catch (e: any) {
      tryToFetch = false;
      resultCode = e.response?.status || 500;
      resultBody = e.message;
    }
  }

  return {
    resultCode,
    resultBody:
      typeof resultBody !== "string" ? JSON.stringify(resultBody) : resultBody,
  };
}
