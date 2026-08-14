import type { Strategy, StrategyVersion } from "./Strategy";

export interface StrategyRepository {
  findAllByUserId(userId: string): Promise<Strategy[]>;
  findById(id: string): Promise<Strategy | null>;
  findVersionById(id: string): Promise<StrategyVersion | null>;
  save(strategy: Strategy): Promise<void>;
  createNextVersion(strategyId: string, definition: StrategyVersion["definition"],
    schemaVersion: number, createdAt: Date): Promise<StrategyVersion>;
}
