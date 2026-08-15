import type { BotDto } from "@/src/modules/bot/dto/BotDto";
import type { PairDto } from "@/src/modules/pair/dto/PairDto";
import type { BacktestFill, BacktestMetrics, BacktestClosedPosition, BacktestOpenPosition,
  HistoricalBacktestDecision, HistoricalBacktestEvent } from "@/src/modules/bot";

export type CreateBotRequest = {
  name: string;
  pairSymbol: string;
  assignedBudget: string;
  amountPerPosition: string;
  timeframe: string;
  strategyVersionId: string;
  feeRate: string;
  slippageRate: string;
};

export type BacktestView = {
  runId: string;
  metrics: BacktestMetrics;
  decisions: HistoricalBacktestDecision[];
  fills: BacktestFill[];
  events: HistoricalBacktestEvent[];
  positions: BacktestClosedPosition[];
  openPositions: BacktestOpenPosition[];
};

type ApiError = { error?: { message?: string } };

export class BotApiClient {
  constructor(private readonly fetchImplementation: typeof fetch = globalThis.fetch) {}

  private async request<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await this.fetchImplementation.call(globalThis, url, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
      },
    });
    const body = (response.status === 204 ? {} : await response.json()) as T & ApiError;
    if (!response.ok) throw new Error(body.error?.message ?? `Bot API request failed (${response.status})`);
    return body;
  }

  async list(): Promise<BotDto[]> {
    return (await this.request<{ bots: BotDto[] }>("/api/bots")).bots;
  }

  async listPairs(): Promise<PairDto[]> {
    return (await this.request<{ data: PairDto[] }>("/api/pairs")).data;
  }

  async create(input: CreateBotRequest): Promise<BotDto> {
    return (await this.request<{ bot: BotDto }>("/api/bots", {
      method: "POST",
      body: JSON.stringify({ ...input, mode: "BACKTEST" }),
    })).bot;
  }

  async update(botId: string, input: Partial<CreateBotRequest> & { archived?: boolean }): Promise<BotDto> {
    return (await this.request<{ bot: BotDto }>(`/api/bots/${encodeURIComponent(botId)}`, {
      method: "PATCH", body: JSON.stringify(input),
    })).bot;
  }

  async delete(botId: string): Promise<void> {
    await this.request(`/api/bots/${encodeURIComponent(botId)}`, { method: "DELETE" });
  }

  async runBacktest(botId: string, from: string, to: string): Promise<BacktestView> {
    return (await this.request<{ backtest: BacktestView }>(`/api/bots/${encodeURIComponent(botId)}/backtests`, {
      method: "POST", body: JSON.stringify({ from, to }),
    })).backtest;
  }
}
