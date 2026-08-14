import type { StrategyRepository } from "../domain/StrategyRepository";
import { validateStrategyDefinition } from "../domain/StrategyDefinition";

export class AddStrategyVersionUseCase {
  constructor(private readonly repository: StrategyRepository) {}
  async execute(userId: string, strategyId: string, definition: unknown, schemaVersion = 1) {
    const strategy = await this.repository.findById(strategyId);
    if (!strategy || strategy.userId !== userId)
      return { ok: false as const, error: "Strategy not found", version: null };
    const validated = validateStrategyDefinition(definition, schemaVersion);
    if (!validated.ok) return { ok: false as const, error: `${validated.issues[0].path}: ${validated.issues[0].message}`, version: null };
    const version = await this.repository.createNextVersion(
      strategyId, validated.definition, schemaVersion, new Date(),
    );
    return { ok: true as const, error: "", version };
  }
}
