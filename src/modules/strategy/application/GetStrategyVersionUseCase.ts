import type { StrategyRepository } from "../domain/StrategyRepository";

export class GetStrategyVersionUseCase {
  constructor(private readonly repository: StrategyRepository) {}
  async execute(userId: string, strategyId: string, versionNumber: number) {
    if (!Number.isSafeInteger(versionNumber) || versionNumber <= 0) return null;
    const strategy = await this.repository.findById(strategyId);
    if (!strategy || strategy.userId !== userId) return null;
    return strategy.versions.find((version) => version.version === versionNumber) ?? null;
  }
}
