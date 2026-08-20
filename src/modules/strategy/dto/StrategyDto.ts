import type { Strategy } from "../domain/Strategy";

export type StrategyDto = Omit<Strategy, "createdAt" | "updatedAt" | "archivedAt" | "versions"> & {
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  versions: Array<Omit<Strategy["versions"][number], "createdAt"> & { createdAt: string }>;
};

export const toStrategyDto = (strategy: Strategy): StrategyDto => ({
  ...strategy,
  createdAt: strategy.createdAt.toISOString(),
  updatedAt: strategy.updatedAt.toISOString(),
  archivedAt: strategy.archivedAt?.toISOString() ?? null,
  versions: strategy.versions.map((version) => ({ ...version, createdAt: version.createdAt.toISOString() })),
});
