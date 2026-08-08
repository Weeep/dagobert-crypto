import type { NextApiRequest, NextApiResponse } from "next";
import type { Account } from "binance-api-node";
import { rejectNonGetMethod, sendReadApiError } from "./readApiHelpers";

export interface AvailableSpotBalance {
  asset: string;
  free: string;
}

export interface BinanceHealth {
  status: "ok";
  serverTime: number;
  latencyMs: number;
  accountType: string;
  canTrade: boolean;
  balances: AvailableSpotBalance[];
}

interface BinanceHealthClient {
  ping(): Promise<boolean>;
  time(): Promise<number>;
  accountInfo(options: { useServerTime: boolean }): Promise<Account>;
}

export function createBinanceHealthHandler(client: BinanceHealthClient) {
  return async function binanceHealthHandler(
    req: NextApiRequest,
    res: NextApiResponse
  ): Promise<void> {
    if (req.method !== "GET") {
      rejectNonGetMethod(res);
      return;
    }

    try {
      const startedAt = Date.now();
      const [isReachable, serverTime, account] = await Promise.all([
        client.ping(),
        client.time(),
        client.accountInfo({ useServerTime: true }),
      ]);

      if (!isReachable) {
        throw new Error("Binance ping failed");
      }

      const usdcBalance = account.balances.find(
        (balance) => balance.asset === "USDC"
      );
      const balances = [
        { asset: "USDC", free: usdcBalance?.free ?? "0" },
      ];

      res.status(200).json({
        data: {
          status: "ok",
          serverTime,
          latencyMs: Date.now() - startedAt,
          accountType: account.accountType,
          canTrade: account.canTrade,
          balances,
        } satisfies BinanceHealth,
      });
    } catch (error) {
      console.error("Binance health check failed", error);
      sendReadApiError(
        res,
        503,
        "INTERNAL_ERROR",
        "Binance API connection unavailable"
      );
    }
  };
}
