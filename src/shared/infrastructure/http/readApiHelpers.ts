import type { NextApiResponse } from "next";
import type { ReadApiErrorCode } from "../../dto/ReadApiResponse";

export function sendReadApiError(
  res: NextApiResponse,
  status: number,
  code: ReadApiErrorCode,
  message: string
): void {
  res.status(status).json({ error: { code, message } });
}

export function getSingleQueryValue(value: string | string[] | undefined): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

export function rejectNonGetMethod(res: NextApiResponse): void {
  res.setHeader("Allow", "GET");
  sendReadApiError(res, 405, "METHOD_NOT_ALLOWED", "Method not allowed");
}
