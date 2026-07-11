import type { NextApiRequest, NextApiResponse } from "next";
import { kv } from "@vercel/kv";
import { withAuth } from "@/utils/auth";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let { email, password } = req.query;
  email = email as string;
  password = password as string;

  if (!email || !password) {
    return res.status(400).json({ error: "Missing parameter(s)" });
  }

  const r1 = await kv.hget("users", email);
  if (r1) {
    res.status(200).json("User already exists.");
  }

  await kv.hset("users", { [email]: password });

  const resp = await kv.hget("users", email);

  return res.status(200).json(resp);
}

export default withAuth(handler);
