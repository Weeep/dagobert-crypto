import type { NextApiRequest, NextApiResponse } from "next";
import type { ReadApiResponse } from "../../dto/ReadApiResponse";
import { rejectNonGetMethod, sendReadApiError } from "./readApiHelpers";

export type DatabaseHealth = { status: "ok"; database: "postgresql" };

export function createDatabaseHealthHandler(
  checkConnection: () => Promise<boolean>
) {
  return async function databaseHealthHandler(
    req: NextApiRequest,
    res: NextApiResponse<ReadApiResponse<DatabaseHealth>>
  ): Promise<void> {
    if (req.method !== "GET") {
      rejectNonGetMethod(res);
      return;
    }

    try {
      if (!(await checkConnection())) {
        sendReadApiError(
          res,
          503,
          "INTERNAL_ERROR",
          "Database connection unavailable"
        );
        return;
      }
      res.status(200).json({ data: { status: "ok", database: "postgresql" } });
    } catch {
      sendReadApiError(
        res,
        503,
        "INTERNAL_ERROR",
        "Database connection unavailable"
      );
    }
  };
}
