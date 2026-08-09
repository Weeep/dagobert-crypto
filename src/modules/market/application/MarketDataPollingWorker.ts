import { MARKET_INTERVAL_MILLISECONDS } from "../domain/Candle";
import type { MarketDataSubscription } from "../domain/MarketDataSubscription";
import type { DiscoverMarketDataSubscriptionsUseCase } from "./DiscoverMarketDataSubscriptionsUseCase";
import type { PollClosedCandlesResult, PollClosedCandlesUseCase } from "./PollClosedCandlesUseCase";

export type MarketDataPollingWorkerOptions = {
  closeGraceMs?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  backoffJitterRatio?: number;
  discoveryIntervalMs?: number;
  maxCandlesPerPoll?: number;
};

export type MarketDataPollingOutcome = {
  subscription: MarketDataSubscription;
  result?: PollClosedCandlesResult;
  error?: string;
  consecutiveFailures: number;
  nextRunAt: Date;
};

type WorkerState = { consecutiveFailures: number; nextRunAt: number };
type Sleep = (milliseconds: number, signal: AbortSignal) => Promise<void>;

const subscriptionKey = ({ pairSymbol, interval }: MarketDataSubscription) => `${pairSymbol}:${interval}`;

export class MarketDataPollingWorker {
  private readonly states = new Map<string, WorkerState>();
  private readonly options: Required<MarketDataPollingWorkerOptions>;

  constructor(
    private readonly discover: DiscoverMarketDataSubscriptionsUseCase,
    private readonly poll: PollClosedCandlesUseCase,
    options: MarketDataPollingWorkerOptions = {},
    private readonly now: () => Date = () => new Date(),
    private readonly sleep: Sleep = MarketDataPollingWorker.sleep,
    private readonly random: () => number = Math.random,
    private readonly onOutcome?: (outcome: MarketDataPollingOutcome) => void | Promise<void>,
  ) {
    this.options = {
      closeGraceMs: options.closeGraceMs ?? 5_000,
      baseBackoffMs: options.baseBackoffMs ?? 1_000,
      maxBackoffMs: options.maxBackoffMs ?? 60_000,
      backoffJitterRatio: options.backoffJitterRatio ?? 0.2,
      discoveryIntervalMs: options.discoveryIntervalMs ?? 60_000,
      maxCandlesPerPoll: options.maxCandlesPerPoll ?? 1_000,
    };
    this.validateOptions();
  }

  async runOnce(signal?: AbortSignal): Promise<MarketDataPollingOutcome[]> {
    const subscriptions = await this.discover.execute();
    return Promise.all(subscriptions.map((subscription) => this.execute(subscription, signal)));
  }

  async run(signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      const subscriptions = await this.discover.execute();
      const activeKeys = new Set(subscriptions.map(subscriptionKey));
      for (const key of Array.from(this.states.keys())) if (!activeKeys.has(key)) this.states.delete(key);
      const currentTime = this.now().getTime();
      const due = subscriptions.filter((subscription) =>
        (this.states.get(subscriptionKey(subscription))?.nextRunAt ?? currentTime) <= currentTime);
      if (due.length > 0) await Promise.all(due.map((subscription) => this.execute(subscription, signal)));
      if (signal.aborted) break;
      const nextRunAt = Math.min(
        currentTime + this.options.discoveryIntervalMs,
        ...subscriptions.map((subscription) =>
          this.states.get(subscriptionKey(subscription))?.nextRunAt ?? currentTime),
      );
      await this.sleep(Math.max(1, nextRunAt - this.now().getTime()), signal);
    }
  }

  nextBoundary(subscription: MarketDataSubscription, from = this.now()): Date {
    const intervalMs = MARKET_INTERVAL_MILLISECONDS[subscription.interval];
    const boundary = Math.floor(from.getTime() / intervalMs) * intervalMs;
    const currentBoundaryWithGrace = boundary + this.options.closeGraceMs;
    return new Date(from.getTime() < currentBoundaryWithGrace
      ? currentBoundaryWithGrace
      : boundary + intervalMs + this.options.closeGraceMs);
  }

  private async execute(subscription: MarketDataSubscription,
    signal?: AbortSignal): Promise<MarketDataPollingOutcome> {
    const key = subscriptionKey(subscription);
    const previousFailures = this.states.get(key)?.consecutiveFailures ?? 0;
    try {
      const result = await this.poll.execute({ ...subscription,
        maxCandles: this.options.maxCandlesPerPoll, signal });
      const nextRunAt = result.hasMoreWork ? this.now() : this.nextBoundary(subscription);
      this.states.set(key, { consecutiveFailures: 0, nextRunAt: nextRunAt.getTime() });
      const outcome = { subscription, result, consecutiveFailures: 0, nextRunAt };
      await this.onOutcome?.(outcome);
      return outcome;
    } catch (error) {
      if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) throw error;
      const consecutiveFailures = previousFailures + 1;
      const exponential = this.options.baseBackoffMs * (2 ** (consecutiveFailures - 1));
      const jitter = 1 + ((this.random() * 2 - 1) * this.options.backoffJitterRatio);
      const delay = Math.max(1, Math.min(this.options.maxBackoffMs, Math.round(exponential * jitter)));
      const nextRunAt = new Date(this.now().getTime() + delay);
      this.states.set(key, { consecutiveFailures, nextRunAt: nextRunAt.getTime() });
      const outcome = { subscription, error: error instanceof Error ? error.message : String(error),
        consecutiveFailures, nextRunAt };
      await this.onOutcome?.(outcome);
      return outcome;
    }
  }

  private validateOptions(): void {
    for (const [name, value] of Object.entries(this.options))
      if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a non-negative number`);
    if (this.options.baseBackoffMs < 1 || this.options.maxBackoffMs < this.options.baseBackoffMs)
      throw new Error("backoff limits are invalid");
    if (this.options.backoffJitterRatio > 1) throw new Error("backoffJitterRatio must be at most 1");
    if (!Number.isInteger(this.options.maxCandlesPerPoll) || this.options.maxCandlesPerPoll < 2 ||
      this.options.maxCandlesPerPoll > 1_000)
      throw new Error("maxCandlesPerPoll must be an integer between 2 and 1000");
  }

  private static sleep(milliseconds: number, signal: AbortSignal): Promise<void> {
    if (signal.aborted) return Promise.resolve();
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, milliseconds);
      signal.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
    });
  }
}
