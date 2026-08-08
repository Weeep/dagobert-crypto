import type { Strategy } from "../domain/Strategy";

export type StrategyDto = Omit<Strategy, "createdAt" | "updatedAt" | "versions"> & {
  createdAt: string;
  updatedAt: string;
  versions: Array<Omit<Strategy["versions"][number], "createdAt"> & { createdAt: string }>;
};

export const toStrategyDto = (strategy: Strategy): StrategyDto => ({
  ...strategy,
  createdAt: strategy.createdAt.toISOString(),
  updatedAt: strategy.updatedAt.toISOString(),
  versions: strategy.versions.map((version) => ({ ...version, createdAt: version.createdAt.toISOString() })),
});
