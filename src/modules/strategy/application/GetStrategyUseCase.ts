import type { StrategyRepository } from "../domain/StrategyRepository";

export class GetStrategyUseCase {
  constructor(private readonly repository: StrategyRepository) {}
  async execute(userId: string, strategyId: string) {
    const strategy = await this.repository.findById(strategyId);
    return strategy?.userId === userId ? strategy : null;
  }
}
