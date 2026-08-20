import { randomUUID } from "node:crypto";
import type { StrategyRepository } from "../domain/StrategyRepository";
import type { Strategy } from "../domain/Strategy";
import { validateStrategyDefinition } from "../domain/StrategyDefinition";

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
    if ((await this.repository.findAllByUserId(input.userId)).some((strategy) => strategy.name === name))
      return { ok: false as const, error: `Strategy already exists: ${name}`, strategy: null };
    const validated = validateStrategyDefinition(input.definition, input.schemaVersion ?? 1);
    if (!validated.ok) return { ok: false as const, error: `${validated.issues[0].path}: ${validated.issues[0].message}`, strategy: null };
    const now = new Date();
    const strategyId = randomUUID();
    const strategy: Strategy = {
      id: strategyId, userId: input.userId, name, description: input.description?.trim() ?? "", archivedAt: null,
      versions: [{ id: randomUUID(), strategyId, version: 1, schemaVersion: input.schemaVersion ?? 1,
        definition: validated.definition, createdAt: now }], createdAt: now, updatedAt: now,
    };
    await this.repository.save(strategy);
    return { ok: true as const, error: "", strategy };
  }
}
