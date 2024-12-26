import { TransactionIf } from "@/app/components/Interfaces";
import { kv } from "@vercel/kv";
import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { data } = req.body;

  if (!data) {
    return res.status(400).json({ error: "Missing data" });
  }

  console.log(data);

  let transactions = JSON.parse(data) as TransactionIf[];
  if (
    transactions.length > 0 &&
    transactions[0]?.orderId &&
    transactions[0]?.updateTime
  ) {
    console.log("yessss");

    //TODO try catch
    transactions.map(async (transaction) => {
      await kv.hset("transactions", { [transaction.orderId]: transaction });
    });
  } else {
    console.log("noo yesss");
  }

  return res.status(200).json({ success: true });

  /*
  const storedPassword = kv.get(email);
  if (storedPassword && storedPassword === password) {
    return res.status(200).json({ success: true });
  }

  return res.status(401).json({ error: "Invalid credentials" });
  */
}

/*
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
*/
