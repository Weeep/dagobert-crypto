import type { NextApiRequest, NextApiResponse } from 'next'
 
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const apiKey: string = process.env.BAPI_KEY as string;
  const apiSecret: string = process.env.BAPI_SEC as string;

  res.status(200).json({
    k1: apiKey,
    k2: apiSecret
  })
  
}