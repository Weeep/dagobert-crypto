import { randomUUID } from "node:crypto";
import type { StrategyRepository } from "../domain/StrategyRepository";
import { validateStrategyDefinition } from "../domain/StrategyDefinition";

export class AddStrategyVersionUseCase {
  constructor(private readonly repository: StrategyRepository) {}
  async execute(strategyId: string, definition: unknown, schemaVersion = 1) {
    const strategy = await this.repository.findById(strategyId);
    if (!strategy) return { ok: false as const, error: "Strategy not found", version: null };
    const validated = validateStrategyDefinition(definition, schemaVersion);
    if (!validated.ok) return { ok: false as const, error: `${validated.issues[0].path}: ${validated.issues[0].message}`, version: null };
    const version = { id: randomUUID(), strategyId, version: Math.max(0, ...strategy.versions.map((v) => v.version)) + 1,
      schemaVersion, definition: validated.definition, createdAt: new Date() };
    await this.repository.addVersion(version);
    return { ok: true as const, error: "", version };
  }
}
