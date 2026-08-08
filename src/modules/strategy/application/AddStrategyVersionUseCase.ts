import { randomUUID } from "node:crypto";
import type { StrategyRepository } from "../domain/StrategyRepository";

export class AddStrategyVersionUseCase {
  constructor(private readonly repository: StrategyRepository) {}
  async execute(strategyId: string, definition: unknown, schemaVersion = 1) {
    const strategy = await this.repository.findById(strategyId);
    if (!strategy) return { ok: false as const, error: "Strategy not found", version: null };
    if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
      return { ok: false as const, error: "Strategy definition must be a JSON object", version: null };
    }
    const version = { id: randomUUID(), strategyId, version: Math.max(0, ...strategy.versions.map((v) => v.version)) + 1,
      schemaVersion, definition, createdAt: new Date() };
    await this.repository.addVersion(version);
    return { ok: true as const, error: "", version };
  }
}
