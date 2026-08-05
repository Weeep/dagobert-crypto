import type { NextApiRequest, NextApiResponse } from "next";

export const DATA_SOURCE_HEADER = "x-dagobert-data-source";

export function usesPostgres(
  req: NextApiRequest,
  postgresWritesEnabled = false
): boolean {
  return (
    req.headers[DATA_SOURCE_HEADER] === "postgres" &&
    (req.method === "GET" || postgresWritesEnabled)
  );
}

type ApiHandler = (
  req: NextApiRequest,
  res: NextApiResponse
) => void | Promise<void>;

/** Selects PostgreSQL for comparison reads and explicitly enabled migration writes. */
export function selectDataSourceHandler(
  redisHandler: ApiHandler,
  postgresHandler: ApiHandler,
  options: { postgresWritesEnabled?: boolean } = {}
): ApiHandler {
  return async (req, res) => {
    await (usesPostgres(req, options.postgresWritesEnabled)
      ? postgresHandler
      : redisHandler)(req, res);
  };
}
