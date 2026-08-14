import type { BotDto } from "@/src/modules/bot/dto/BotDto";
import type { PairDto } from "@/src/modules/pair/dto/PairDto";

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
    const body = await response.json() as T & ApiError;
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
}
