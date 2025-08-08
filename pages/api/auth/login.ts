import type { NextApiRequest, NextApiResponse } from "next";
import { serialize } from "cookie";
import DbApiUtil from "@/utils/dbapiutil";
import { generateToken } from "@/utils/auth";
import { ApiResponse, KVRoot } from "@/utils/typesAndEnums";

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
    const response: ApiResponse = await DbApiUtil.hget(KVRoot.users, email);
    if (!response.ok) {
      throw new Error(`${response.error} (${response.code})`);
    }
    const storedPassword = response.response;

    console.log(storedPassword);
    console.log(password);

    if (storedPassword && storedPassword === password) {
      const token = generateToken(email);

      res.setHeader(
        "Set-Cookie",
        serialize("token", token, {
          httpOnly: true,
          secure: false, //TODO!!! https , process.env.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: 36000,
          path: "/",
        })
      );

      return res.status(200).json({ success: true });
    } else {
      return res.status(401).json({ error: "Invalid credentials" });
    }
  } catch (error) {
    return res
      .status(500)
      .json({ error: `Error: ${(error as Error).message}` });
  }
}
