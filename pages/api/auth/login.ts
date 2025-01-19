import type { NextApiRequest, NextApiResponse } from "next";
import { serialize } from "cookie";
import kv from "@vercel/kv";
import { generateToken } from "@/utils/auth";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Missing email or password" });
  }

  const storedPassword = await kv.hget("users", email);

  if (storedPassword && storedPassword === password) {
    try {
      const token = generateToken(email);

      res.setHeader(
        "Set-Cookie",
        serialize("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: 36000,
          path: "/",
        })
      );
    } catch (error) {
      return res
        .status(500)
        .json({ error: `Error: ${(error as Error).message}` });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(401).json({ error: "Invalid credentials" });
}
