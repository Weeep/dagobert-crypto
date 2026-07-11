import type { NextApiRequest, NextApiResponse } from "next";

interface IpInfo {
  ip: string;
  checkLocation: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<IpInfo>
) {
  const ipUrl = "https://api.ipify.org/?format=json";
  try {
    const ipRes = await fetch(ipUrl);
    const ipInfo: IpInfo = await ipRes.json();

    res
      .status(200)
      .json({ ip: ipInfo.ip, checkLocation: "https://ipinfo.ai/" });
  } catch (error: any) {
    res.status(error.response.status).json(error.message);
  }
}
