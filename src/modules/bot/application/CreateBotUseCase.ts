import Big from "big.js";
import { randomUUID } from "node:crypto";
import type { BotRepository } from "../domain/BotRepository";
import { BOT_TIMEFRAMES, type BotMode, type TradingBot } from "../domain/TradingBot";

export type CreateBotInput = {
  userId: string;
  name: string;
  pairSymbol: string;
  assignedBudget: string;
  amountPerPosition: string;
  timeframe: string;
  mode?: BotMode;
  strategyVersionId: string;
  feeRate?: string;
  slippageRate?: string;
};

export type BotMutationResult =
  | { ok: true; error: ""; bot: TradingBot }
  | { ok: false; error: string; bot: null };

export class CreateBotUseCase {
  constructor(
    private readonly repository: BotRepository,
    private readonly strategyOwner?: (id: string) => Promise<string | null>,
    private readonly pairExists?: (symbol: string) => Promise<boolean>
  ) {}

  async execute(input: CreateBotInput): Promise<BotMutationResult> {
    const name = input.name.trim();
    const pairSymbol = input.pairSymbol.trim().toUpperCase();
    if (!name) return { ok: false, error: "Missing bot name", bot: null };
    if (!/^[A-Z0-9]+USDC$/.test(pairSymbol)) {
      return { ok: false, error: "Bot pair must be quoted in USDC", bot: null };
    }
    if (!BOT_TIMEFRAMES.includes(input.timeframe as (typeof BOT_TIMEFRAMES)[number])) {
      return { ok: false, error: "Unsupported timeframe", bot: null };
    }
    if (!input.userId || !input.strategyVersionId) {
      return { ok: false, error: "Missing owner or strategy version", bot: null };
    }
    if (input.mode && input.mode !== "BACKTEST") {
      return { ok: false, error: "New bots must start in BACKTEST mode", bot: null };
    }
    if (!this.isPositive(input.assignedBudget) || !this.isPositive(input.amountPerPosition)) {
      return { ok: false, error: "Budgets must be positive decimals", bot: null };
    }
    const feeRate = input.feeRate ?? "0";
    const slippageRate = input.slippageRate ?? "0";
    if (!this.isNonNegative(feeRate) || !this.isNonNegative(slippageRate)) {
      return { ok: false, error: "Fee and slippage rates cannot be negative", bot: null };
    }
    if (new Big(input.amountPerPosition).times(new Big(1).plus(feeRate)).gt(input.assignedBudget)) {
      return { ok: false, error: "Position amount plus fees exceeds assigned budget", bot: null };
    }
    if (this.strategyOwner) {
      if (await this.strategyOwner(input.strategyVersionId) !== input.userId) {
        return { ok: false, error: "Strategy version not found for owner", bot: null };
      }
    }
    if (this.pairExists && !await this.pairExists(pairSymbol)) {
      return { ok: false, error: "Trading pair not found", bot: null };
    }
    if (await this.repository.findByUserIdAndName(input.userId, name)) {
      return { ok: false, error: `Bot already exists: ${name}`, bot: null };
    }

    const now = new Date();
    const bot: TradingBot = {
      id: randomUUID(), userId: input.userId, name, pairSymbol,
      assignedBudget: new Big(input.assignedBudget).toString(),
      amountPerPosition: new Big(input.amountPerPosition).toString(),
      timeframe: input.timeframe as TradingBot["timeframe"], mode: input.mode ?? "BACKTEST",
      status: "DRAFT", strategyVersionId: input.strategyVersionId,
      feeRate: new Big(feeRate).toString(), slippageRate: new Big(slippageRate).toString(),
      createdAt: now, updatedAt: now,
    };
    await this.repository.save(bot);
    return { ok: true, error: "", bot };
  }

  private isPositive(value: string): boolean {
    try { return new Big(value).gt(0); } catch { return false; }
  }
  private isNonNegative(value: string): boolean {
    try { return new Big(value).gte(0); } catch { return false; }
  }
}
