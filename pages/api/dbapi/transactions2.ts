import { TransactionIf } from "@/app/components/Interfaces";
import { ukv } from "@/utils/dbapiutil";
import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { data } = req.body;

  if (!data) {
    return res.status(400).json({ error: "Missing data" });
  }

  let transactions = JSON.parse(data) as TransactionIf[]; // TODO !!!
  if (
    transactions.length > 0 &&
    transactions[0]?.orderId &&
    transactions[0]?.updateTime
  ) {
    transactions.map(async (transaction) => {
      await ukv.hset("transactions", { [transaction.orderId]: transaction });
    });
    // TODO check it successfully done?
  }

  return res.status(200).json({ success: true });
}
