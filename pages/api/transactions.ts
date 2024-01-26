import type { NextApiRequest, NextApiResponse } from 'next'
 
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  let binanceUrl = 'https://api.binance.com/api/v3/allOrders';
    
  const apiKey: string = process.env.BAPI_KEY as string;
  const apiSecret: string = process.env.BAPI_SEC as string;
  
  const params: Record<string, any> = {
      'symbol': 'SOLUSDT',
      'timestamp': Math.floor(Date.now())
  }

  const query = new URLSearchParams(params).toString();
  
  const sign = require('crypto').createHmac('sha256', apiSecret).update(query).digest('hex');
  
  binanceUrl += `?${query}&signature=${sign}`;

  const header: RequestInit = {
      'headers': {
          'Content-Type': 'application/json',
          'X-MBX-APIKEY': apiKey 
      }
  };

  try {
      const binanceRes = await fetch(binanceUrl, header)
      
      const transactions = await binanceRes.json()

      res.status(200).json(transactions)
  } catch (error: any) {
      res.status(error.response.status).json(error.message);
  }
}