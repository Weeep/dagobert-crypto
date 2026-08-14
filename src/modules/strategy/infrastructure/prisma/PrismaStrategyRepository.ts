import { Prisma, type PrismaClient } from "@prisma/client";
import type { Strategy, StrategyDefinitionV1, StrategyRepository, StrategyVersion } from "@/src/modules/strategy";

type StrategyWithVersions = Prisma.StrategyGetPayload<{ include: { versions: true } }>;
const mapVersion = (row: StrategyWithVersions["versions"][number]): StrategyVersion => ({
  id: row.id, strategyId: row.strategyId, version: row.version, schemaVersion: row.schemaVersion,
  definition: row.definition as unknown as StrategyDefinitionV1, createdAt: row.createdAt,
});
const mapStrategy = (row: StrategyWithVersions): Strategy => ({
  id: row.id, userId: row.userId, name: row.name, description: row.description,
  versions: row.versions.map(mapVersion), createdAt: row.createdAt, updatedAt: row.updatedAt,
});
const json = (value: unknown) => value as Prisma.InputJsonValue;

export class PrismaStrategyRepository implements StrategyRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async findAllByUserId(userId: string) {
    return (await this.prisma.strategy.findMany({ where: { userId }, include: { versions: { orderBy: { version: "asc" } } } })).map(mapStrategy);
  }
  async findById(id: string) {
    const row = await this.prisma.strategy.findUnique({ where: { id }, include: { versions: { orderBy: { version: "asc" } } } });
    return row ? mapStrategy(row) : null;
  }
  async findVersionById(id: string) {
    const row = await this.prisma.strategyVersion.findUnique({ where: { id } });
    return row ? mapVersion(row) : null;
  }
  async save(strategy: Strategy) {
    await this.prisma.strategy.upsert({
      where: { id: strategy.id },
      create: { id: strategy.id, userId: strategy.userId, name: strategy.name,
        description: strategy.description, createdAt: strategy.createdAt, updatedAt: strategy.updatedAt,
        versions: { create: strategy.versions.map((v) => ({ id: v.id, version: v.version,
          schemaVersion: v.schemaVersion, definition: json(v.definition), createdAt: v.createdAt })) } },
      update: { name: strategy.name, description: strategy.description, updatedAt: strategy.updatedAt },
    });
  }
  async addVersion(version: StrategyVersion) {
    await this.prisma.strategyVersion.create({ data: { id: version.id, strategyId: version.strategyId,
      version: version.version, schemaVersion: version.schemaVersion,
      definition: json(version.definition), createdAt: version.createdAt } });
  }
}
