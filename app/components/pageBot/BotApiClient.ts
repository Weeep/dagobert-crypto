import type { BotDto } from "@/src/modules/bot/dto/BotDto";
import type { PairDto } from "@/src/modules/pair/dto/PairDto";
import type { BacktestFill, BacktestMetrics, HistoricalBacktestDecision } from "@/src/modules/bot";

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
  includeFullTimeline: boolean;
  metrics: BacktestMetrics;
  decisions: HistoricalBacktestDecision[];
  fills: BacktestFill[];
};
export type BotErrorDetails = { runId: string; message: string; occurredAt: string };
export type BacktestProgress = { phase: "LOADING" | "EVALUATING" | "SAVING"; processedCandles: number;
  totalCandles: number; loadedCandles?: number; percent: number;
  currentCandleOpenTime?: string; currentOperation?: string;
  decisions: { HOLD: number; BUY: number; SELL: number } };

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

  async errorDetails(botId: string): Promise<BotErrorDetails | null> {
    return (await this.request<{ errorDetails: BotErrorDetails | null }>(
      `/api/bots/${encodeURIComponent(botId)}/error`)).errorDetails;
  }

  async runBacktest(botId: string, from: string, to: string, includeFullTimeline = false,
    onProgress?: (progress: BacktestProgress) => void): Promise<BacktestView> {
    const response = await this.fetchImplementation.call(globalThis,
      `/api/bots/${encodeURIComponent(botId)}/backtests?stream=1`, { method: "POST",
        headers: { Accept: "application/x-ndjson", "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, includeFullTimeline }) });
    if (!response.ok || !response.body) {
      const body = await response.json().catch(() => ({})) as ApiError;
      throw new Error(body.error?.message ?? `Backtest request failed (${response.status})`);
    }
    const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
    const resultChunks: Pick<BacktestView, "decisions" | "fills"> = { decisions: [], fills: [] };
    while (true) {
      const chunk = await reader.read(); buffer += decoder.decode(chunk.value, { stream: !chunk.done });
      const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line) as { type: string; progress?: BacktestProgress; backtest?: BacktestView;
          field?: keyof typeof resultChunks; items?: unknown[]; message?: string };
        if (event.type === "progress" && event.progress) onProgress?.(event.progress);
        if (event.type === "result-chunk" && event.field && event.items)
          (resultChunks[event.field] as unknown[]).push(...event.items);
        if (event.type === "complete" && event.backtest) return { ...event.backtest, ...resultChunks };
        if (event.type === "error") throw new Error(event.message ?? "Backtest execution failed");
      }
      if (chunk.done) break;
    }
    throw new Error("The backtest connection closed before a result was received. Please retry.");
  }
}
