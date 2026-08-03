import type { NextApiRequest, NextApiResponse } from "next";

export const DATA_SOURCE_HEADER = "x-dagobert-data-source";

export function usesPostgres(req: NextApiRequest): boolean {
  return req.method === "GET" && req.headers[DATA_SOURCE_HEADER] === "postgres";
}

type ApiHandler = (
  req: NextApiRequest,
  res: NextApiResponse
) => void | Promise<void>;

/** Selects PostgreSQL for comparison reads; every write remains on Redis. */
export function selectDataSourceHandler(
  redisHandler: ApiHandler,
  postgresReadHandler: ApiHandler
): ApiHandler {
  return async (req, res) => {
    await (usesPostgres(req) ? postgresReadHandler : redisHandler)(req, res);
  };
}
