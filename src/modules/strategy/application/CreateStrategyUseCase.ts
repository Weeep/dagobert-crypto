import { randomUUID } from "node:crypto";
import type { StrategyRepository } from "../domain/StrategyRepository";
import type { Strategy } from "../domain/Strategy";

export type CreateStrategyInput = {
  userId: string;
  name: string;
  description?: string;
  definition: unknown;
  schemaVersion?: number;
};

export class CreateStrategyUseCase {
  constructor(private readonly repository: StrategyRepository) {}
  async execute(input: CreateStrategyInput) {
    const name = input.name.trim();
    if (!input.userId || !name) return { ok: false as const, error: "Missing owner or strategy name", strategy: null };
    if (!input.definition || typeof input.definition !== "object" || Array.isArray(input.definition)) {
      return { ok: false as const, error: "Strategy definition must be a JSON object", strategy: null };
    }
    const now = new Date();
    const strategyId = randomUUID();
    const strategy: Strategy = {
      id: strategyId, userId: input.userId, name, description: input.description?.trim() ?? "",
      versions: [{ id: randomUUID(), strategyId, version: 1, schemaVersion: input.schemaVersion ?? 1,
        definition: input.definition, createdAt: now }], createdAt: now, updatedAt: now,
    };
    await this.repository.save(strategy);
    return { ok: true as const, error: "", strategy };
  }
}
