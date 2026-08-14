import type { NextApiRequest, NextApiResponse } from "next";
import type { StrategyVersion } from "../../domain/Strategy";

export const strategyBody = (body: unknown): Record<string, unknown> | null =>
  typeof body === "object" && body !== null && !Array.isArray(body) ? body as Record<string, unknown> : null;

export const toStrategyVersionDto = (version: StrategyVersion) => ({
  ...version, createdAt: version.createdAt.toISOString(),
});

export function strategyApiError(res: NextApiResponse, status: number, code: string, message: string) {
  return res.status(status).json({ error: { code, message } });
}

export function strategyMethodNotAllowed(res: NextApiResponse, methods: string[]) {
  res.setHeader("Allow", methods.join(", "));
  return strategyApiError(res, 405, "METHOD_NOT_ALLOWED", "Method not allowed");
}

export const withStrategyApiErrors = (
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<unknown>,
) => async (req: NextApiRequest, res: NextApiResponse) => {
  try { return await handler(req, res); }
  catch { return strategyApiError(res, 500, "INTERNAL_ERROR", "Internal server error"); }
};
