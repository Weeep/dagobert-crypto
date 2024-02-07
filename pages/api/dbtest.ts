import { kv } from "@vercel/kv";
import type { NextApiRequest, NextApiResponse } from "next";

interface Ttt {
  alma: string;
  szilva: string;
}

export default async function dbTest(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { action } = req.query;

  if (action && typeof action === "string") {
    if (action === "flushdb") {
      const r: string = await kv.flushdb();
      const lastUpdatedTime: any = await kv.get(
        "updated_time_of_last_processed_transaction"
      );
      res.status(200).json({
        message: `Database cleaned up? ${r}.`,
        test: `Value of updated_time_of_last_processed_transaction: ${lastUpdatedTime}`,
      });
    } else {
      return res.status(400).json({ error: "Invalid action parameter" });
    }
  }

  //await kv.del("test");

  await kv.lpush("test", { alma: "korte", szilva: "barack" });
  await kv.lpush("test", { alma: "szolo", szilva: "eper" });

  await kv.hset("hashtest", { egy: { alma: "szolo" } });
  await kv.hset("hashtest", { ketto: { symbol: "SOL" } });
  await kv.hset("hashtest", { harom: { orderId: "234561212" } });

  const helement = await kv.hget("hashtest", "ketto");
  const hashAll = (await kv.hgetall("hashtest")) || {};

  res.status(200).json(Object.values(hashAll)); //await kv.lrange("test", 0, -1));
}
