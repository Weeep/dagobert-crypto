import type { NextApiRequest, NextApiResponse } from "next";
import { verifyToken } from "@/utils/auth";
import { prisma } from "@/src/shared/infrastructure/prisma/prisma";

export async function authenticatedUserId(req: NextApiRequest, res: NextApiResponse): Promise<string | null> {
  const token = req.cookies.token;
  const email = token ? verifyToken(token) : null;
  if (!email) { res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } }); return null; }
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) { res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } }); return null; }
  return user.id;
}

export const bodyRecord = (body: unknown): Record<string, unknown> | null =>
  typeof body === "object" && body !== null && !Array.isArray(body) ? body as Record<string, unknown> : null;
