import type { NextApiRequest, NextApiResponse } from "next";
import { serialize } from "cookie";
import { serverUseCases } from "@/src/shared/composition/serverUseCases";

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

  try {
    const result = await serverUseCases.login.execute({ email, password });
    if (result.authenticated) {
      res.setHeader(
        "Set-Cookie",
        serialize("token", result.token, {
          httpOnly: true,
          secure: false, //TODO!!! https , process.env.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: 36000,
          path: "/",
        })
      );

      return res.status(200).json({ success: true });
    }

    return res.status(401).json({ error: "Invalid credentials" });
  } catch (error) {
    return res
      .status(500)
      .json({ error: `Error: ${(error as Error).message}` });
  }
}
