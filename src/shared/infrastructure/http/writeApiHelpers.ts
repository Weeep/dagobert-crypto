import type { NextApiResponse } from "next";
import { sendReadApiError } from "./readApiHelpers";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function sendBadRequest(res: NextApiResponse, message: string): void {
  sendReadApiError(res, 400, "BAD_REQUEST", message);
}

export function rejectUnsupportedMethod(
  res: NextApiResponse,
  allowedMethods: string[]
): void {
  res.setHeader("Allow", allowedMethods.join(", "));
  sendReadApiError(res, 405, "METHOD_NOT_ALLOWED", "Method not allowed");
}
