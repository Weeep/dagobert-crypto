import { ukv } from "@/utils/dbapiutil";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "POST") {
    const { key, value } = req.body;

    if (!key || !value) {
      return res.status(400).json({ error: "Missing data" });
    }

    await ukv.sadd(key, value);

    return res.status(200).json({ success: true });
  } else if (req.method === "GET") {
    const { key } = req.query;
    if (!key) {
      return res.status(400).json({ error: "Missing data (key)" });
    }

    const kvRes = await ukv.smembers(key.toString());
    if (!kvRes.ok) {
      return res.status(400).json({ error: "Failed to get info from DB" });
    }

    return res.status(200).json(kvRes.response !== null ? kvRes.response : []);
  } else if (req.method === "DELETE") {
    const { key, value } = req.body;

    if (!key || !value) {
      return res.status(400).json({ error: "Missing data" });
    }

    await ukv.srem(key, value);

    return res.status(200).json({ success: true });
  } else {
    return res.status(405).json({ error: "Method not allowed" });
  }
}
