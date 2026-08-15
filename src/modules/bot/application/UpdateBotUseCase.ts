import Big from "big.js";
import { BOT_TIMEFRAMES, type BotMode, type TradingBot } from "../domain/TradingBot";
import type { BotRepository } from "../domain/BotRepository";

export type UpdateBotInput = Partial<{ name: string; pairSymbol: string; assignedBudget: string;
  amountPerPosition: string; timeframe: string; mode: BotMode; strategyVersionId: string;
  feeRate: string; slippageRate: string; archived: boolean }>;

export class UpdateBotUseCase {
  constructor(
    private readonly bots: BotRepository,
    private readonly strategyOwner: (id: string) => Promise<string | null>,
    private readonly pairExists?: (symbol: string) => Promise<boolean>
  ) {}
  async execute(userId: string, id: string, input: UpdateBotInput) {
    const bot = await this.bots.findById(id);
    if (!bot || bot.userId !== userId) return { ok: false as const, error: "Bot not found", bot: null };
    if (bot.status === "RUNNING") return { ok: false as const, error: "Running bot cannot be edited", bot: null };
    const { archived, ...editable } = input;
    const next = { ...bot, ...editable, archivedAt: archived === undefined ? bot.archivedAt : archived ? new Date() : null,
      name: input.name?.trim() ?? bot.name,
      pairSymbol: input.pairSymbol?.trim().toUpperCase() ?? bot.pairSymbol, updatedAt: new Date() };
    if (!next.name || !/^[A-Z0-9]+USDC$/.test(next.pairSymbol)) return { ok: false as const, error: "Invalid name or USDC pair", bot: null };
    if (this.pairExists && !await this.pairExists(next.pairSymbol)) return { ok: false as const, error: "Trading pair not found", bot: null };
    if (!BOT_TIMEFRAMES.includes(next.timeframe as never)) return { ok: false as const, error: "Unsupported timeframe", bot: null };
    const modes: BotMode[] = ["BACKTEST", "PAPER", "SPOT_TEST", "SPOT_LIVE"];
    if (!modes.includes(next.mode) || modes.indexOf(next.mode) > modes.indexOf(bot.mode) + 1 || modes.indexOf(next.mode) < modes.indexOf(bot.mode))
      return { ok: false as const, error: "Invalid mode transition", bot: null };
    try {
      if (new Big(next.assignedBudget).lte(0) || new Big(next.amountPerPosition).lte(0) ||
          new Big(next.feeRate).lt(0) || new Big(next.slippageRate).lt(0) || new Big(next.slippageRate).gte(1)) throw new Error();
      if (new Big(next.amountPerPosition).gt(next.assignedBudget))
        return { ok: false as const, error: "Position amount exceeds assigned budget", bot: null };
    } catch { return { ok: false as const, error: "Invalid decimal configuration", bot: null }; }
    if (await this.strategyOwner(next.strategyVersionId) !== userId) return { ok: false as const, error: "Strategy version not found for owner", bot: null };
    const duplicate = await this.bots.findByUserIdAndName(userId, next.name);
    if (duplicate && duplicate.id !== id) return { ok: false as const, error: `Bot already exists: ${next.name}`, bot: null };
    const validated = next as TradingBot;
    await this.bots.save(validated);
    return { ok: true as const, error: "", bot: validated };
  }
}
