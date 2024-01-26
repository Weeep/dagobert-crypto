import type { NextApiRequest, NextApiResponse } from 'next'
 
interface IpInfo {
  ip: string;
}
 
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<IpInfo>
) {
  const ipUrl = 'https://api.ipify.org/?format=json';
  try {
    const ipRes = await fetch(ipUrl)
    const ipInfo: IpInfo = await ipRes.json()
    //const ipInfoString = JSON.stringify(ipInfo);

    res.status(200).json(ipInfo)
  } catch (error: any) {
    res.status(error.response.status).json(error.message);
  }
}