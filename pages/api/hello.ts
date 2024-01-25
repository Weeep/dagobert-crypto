import type { NextApiRequest, NextApiResponse } from 'next'
 
type ResponseData = {
  message: string
}

interface IpInfo {
  ip: string;
}
 
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  const ipUrl = 'https://api.ipify.org/?format=json';
  const ipRes = await fetch(ipUrl)
  const ipInfo: IpInfo = await ipRes.json()
  const ipResponse = JSON.stringify(ipInfo);

  let binanceUrl = 'https://api.binance.com/api/v3/allOrders';
    
  const apiKey: string = process.env.BAPI_KEY as string;
  const apiSecret: string = process.env.BAPI_SEC as string;
  
  const params: Record<string, any> = {
      'symbol': 'SOLUSDT',
      'timestamp': Math.floor(Date.now())
  }

  const query = new URLSearchParams(params).toString();
  
  //const sign = this.getSignature(query, this.apiSecret || '');
  const sign = require('crypto').createHmac('sha256', apiSecret).update(query).digest('hex');
  
  binanceUrl += `?${query}&signature=${sign}`;

  const header: RequestInit = {
      'headers': {
          'Content-Type': 'application/json',
          'X-MBX-APIKEY': apiKey 
      }
  };

  //console.log(binanceUrl);
  //let binanceResponse = 'aaa'

  try {
      const binanceRes = await fetch(binanceUrl, header)
      
      const transactions = await binanceRes.json()

      res.status(200).json(transactions)

      /*
      

      binanceResponse = JSON.stringify(transactions);

      return (
          <>
              <h1>Transactions</h1>
              <h2>{ipResponse}</h2>
              <ul>
                  {transactions.map(transaction => <li>{transaction.orderId}</li>)}
              </ul>
          </>
      );
      */
  } catch (error: any) {
      //console.error(`Download error: ${error.message}`);
      /*
      return (
          <>
              <p>{ipResponse}</p>
              <p>{binanceUrl}</p>
              <p>{binanceResponse}</p>
              <p>{error.message}</p>
          </>
      )
      */

      res.status(error.response.status).json(error.message);
  }
  
  //res.status(200).json({ message: ipResponse })
}