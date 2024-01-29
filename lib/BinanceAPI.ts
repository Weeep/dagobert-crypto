const transactions = [
    {
        "symbol": "SOLUSDT",
        "totalUSDTspent": "15.44",
        "executedQty": "0.62000000",
        "cummulativeQuoteQty": "24.90540000",
        "type": "LIMIT",
        "side": "BUY",
        "updateTime": "2024. 01. 29. 08:23",
    },
    {
        "symbol": "MATICUSDT",
        "totalUSDTspent": "28.622428",
        "executedQty": "0.82000000",
        "cummulativeQuoteQty": "34.90540000",
        "type": "LIMIT",
        "side": "SELL",
        "updateTime": "2024. 01. 25. 18:33",
    },
    {
        "symbol": "AVAXUSDT",
        "totalUSDTspent": "28.622428",
        "executedQty": "0.82000000",
        "cummulativeQuoteQty": "34.90540000",
        "type": "LIMIT",
        "side": "BUY",
        "updateTime": "2024. 01. 15. 11:33",
    }
]

// import axios from 'axios';

// class BinanceAPI {
//   private static apiKey?: string;
//   private static apiSecret?: string;

//   public static auth(key: string, secret: string): void {
//     this.apiKey = key;
//     this.apiSecret = secret;
//   }

//   // Will sign and call specified API method
//   public static async call(
//     method: string,
//     params: Record<string, any> = {},
//     httpMethod: string = 'GET'
//   ): Promise<any> {
//     let host = 'api';
//     if (method.startsWith('/dapi')) {
//       host = 'dapi';
//     }

//     if (method.startsWith('/fapi')) {
//       host = 'fapi';
//     }

//     let url = `https://${host}.binance.com${method}`;

//     if (this.signed(method)) {
    //   params.timestamp = Math.floor(Date.now());
    //   const query = new URLSearchParams(params).toString();
    //   const sign = this.getSignature(query, this.apiSecret || '');
    //   url += `?${query}&signature=${sign}`;
//     } else if (Object.keys(params).length > 0) {
//       const query = new URLSearchParams(params).toString();
//       url += `?${query}`;
//     }

//     const headers = { 'X-MBX-APIKEY': this.apiKey };

//     const requestOptions = {
//       method: httpMethod,
//       headers,
//     };

//     if (httpMethod !== 'GET') {
//       requestOptions['data'] = params;
//     }

//     try {
//       const response = await axios(url, requestOptions);
//       return response.data;
//     } catch (error) {
//       console.error('Error calling Binance API:', error.message);
//       throw new Error('Internal Server Error');
//     }
//   }

//   private static signed(method: string): boolean {
//     return !(
//       method.includes('ticker/price') ||
//       method.includes('/exchangeInfo') ||
//       method.includes('/depth')
//     );
//   }

//   private static getSignature(query: string, secret: string): string {
//     return require('crypto').createHmac('sha256', secret).update(query).digest('hex');
//   }
// }

// export default BinanceAPI;
