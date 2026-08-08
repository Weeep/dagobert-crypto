import type { BotRepository } from "../domain/BotRepository";

export class GetBotUseCase {
  constructor(private readonly repository: BotRepository) {}
  async execute(userId: string, id: string) {
    const bot = await this.repository.findById(id);
    return bot?.userId === userId ? bot : null;
  }
}
