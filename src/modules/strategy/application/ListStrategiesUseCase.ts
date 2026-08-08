import type { StrategyRepository } from "../domain/StrategyRepository";
export class ListStrategiesUseCase {
  constructor(private readonly repository: StrategyRepository) {}
  async execute(userId: string) { return this.repository.findAllByUserId(userId); }
}
