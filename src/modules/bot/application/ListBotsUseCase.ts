import type { BotRepository } from "../domain/BotRepository";

export class ListBotsUseCase {
  constructor(private readonly repository: BotRepository) {}
  async execute(userId: string) {
    return (await this.repository.findAllByUserId(userId)).sort((a, b) => a.name.localeCompare(b.name));
  }
}
