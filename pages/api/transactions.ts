import type { NextApiRequest, NextApiResponse } from 'next'
 
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
    const { symbol } = req.query;
    if (!symbol || typeof symbol !== 'string') {
      return res.status(400).json({ error: 'Invalid symbol parameter' });
    }

    const apiKey: string = process.env.BAPI_KEY as string;
    const apiSecret: string = process.env.BAPI_SEC as string;
    
    let tryToFetch = true;
    let msCounter = 0;
    let resultCode = 0;
    let resultBody = '';
    while(tryToFetch && msCounter <= 10) {
        let binanceUrl = 'https://api.binance.com/api/v3/allOrders';
        const params: Record<string, any> = {
            symbol,
            'timestamp': Math.floor(Date.now() + 5000 - (msCounter * 1000))
        }
        //console.log(msCounter)
        msCounter++;
        
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
            tryToFetch = (transactions?.code == -1021)

            resultCode = 200
            resultBody = transactions
        } catch (e: any) {
            tryToFetch = false
            resultCode = (e.response?.status || 500)
            resultBody = e.message
        }
    }

    res.status(resultCode).json(resultBody)
}