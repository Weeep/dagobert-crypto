import DbApiUtil from "@/utils/dbapiutil";
import { KVRoot } from "@/utils/typesAndEnums";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "POST") {
    const { /*key,*/ value } = req.body;

    if (/*!key ||*/ !value) {
      return res.status(400).json({ error: "Missing data" });
    }

    await DbApiUtil.sadd(KVRoot.pairs, value);

    return res.status(200).json({ success: true });
  } else if (req.method === "GET") {
    //const { key } = req.query;
    //if (!key) {
    //  return res.status(400).json({ error: "Missing data (key)" });
    //}

    ///////////////
    const { aaa } = req.query;
    if (aaa) {
      console.log(aaa);
      if (aaa === "all") {
        const response = await DbApiUtil.del("pairs");
        console.log("pairs GET: " + JSON.stringify(response));
      } else {
        const response = await DbApiUtil.srem(KVRoot.pairs, aaa);
        console.log("pairs GET: " + JSON.stringify(response));
      }
    } // TODO Error if symbol is not valid!!!!!!!
    ///////////////////

    const kvRes = await DbApiUtil.smembers(KVRoot.pairs);
    if (!kvRes.ok) {
      return res.status(400).json({ error: "Failed to get info from DB" });
    }

    console.log("pairs GET: " + JSON.stringify(kvRes.response));
    return res.status(200).json(kvRes.response); // !== null ? kvRes.response : []);
  } else if (req.method === "DELETE") {
    const { /*key,*/ value } = req.body;

    if (/*!key ||*/ !value) {
      return res.status(400).json({ error: "Missing data" });
    }

    await DbApiUtil.srem(KVRoot.pairs, value);

    return res.status(200).json({ success: true });
  } else {
    return res.status(405).json({ error: "Method not allowed" });
  }
}
