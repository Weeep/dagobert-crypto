import jwt from "jsonwebtoken";
import { NextApiRequest, NextApiResponse } from "next";
import { parse } from "cookie";

const secretKey: string = process.env.SECRET_KEY as string;

export function generateToken(email: string): string {
  return jwt.sign({ email }, secretKey, { expiresIn: "1h" });
}

export function verifyToken(token: string): string | null {
  try {
    const decoded = jwt.verify(token, secretKey) as { email: string };
    return decoded.email;
  } catch (err) {
    return null;
  }
}

export const withAuth = (
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void> | void
) => {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const cookies = parse(req.headers.cookie || ""); // Parse cookies
    const token = cookies.token; // Extract token

    if (!token || !verifyToken(token)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // If authorized, proceed to the handler
    return handler(req, res);
  };
};
