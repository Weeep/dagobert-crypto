import { JwtAuthTokenService } from "@/src/modules/auth/infrastructure/JwtAuthTokenService";
import { PrismaUserCredentialRepository } from "@/src/modules/auth/infrastructure/prisma/PrismaUserCredentialRepository";
import { PrismaPairRepository } from "@/src/modules/pair/infrastructure/prisma/PrismaPairRepository";
import { PrismaTransactionRepository } from "@/src/modules/transaction/infrastructure/prisma/PrismaTransactionRepository";
import { PrismaTransactionGroupRepository } from "@/src/modules/transaction-group/infrastructure/prisma/PrismaTransactionGroupRepository";
import { PrismaBotRepository } from "@/src/modules/bot/infrastructure/prisma/PrismaBotRepository";
import { PrismaBotRunRepository } from "@/src/modules/bot/infrastructure/prisma/PrismaBotRunRepository";
import { PrismaBotTradingRecordRepository } from "@/src/modules/bot/infrastructure/prisma/PrismaBotTradingRecordRepository";
import { PrismaBotLifecycleRepository } from "@/src/modules/bot/infrastructure/prisma/PrismaBotLifecycleRepository";
import { PrismaBotBudgetRepository } from "@/src/modules/bot/infrastructure/prisma/PrismaBotBudgetRepository";
import { PrismaBacktestRunPersistenceRepository } from "@/src/modules/bot/infrastructure/prisma/PrismaBacktestRunPersistenceRepository";
import { PrismaCandleRepository } from "@/src/modules/market/infrastructure/prisma/PrismaCandleRepository";
import { PrismaStrategyRepository } from "@/src/modules/strategy/infrastructure/prisma/PrismaStrategyRepository";
import { PrismaStrategyEvaluationRepository } from "@/src/modules/strategy/infrastructure/prisma/PrismaStrategyEvaluationRepository";
import { PrismaHealthCheck } from "@/src/shared/infrastructure/prisma/PrismaHealthCheck";
import { prisma } from "@/src/shared/infrastructure/prisma/prisma";
import { createUseCases } from "./createUseCases";
import { createServerUseCasesFromRepositories } from "./createServerUseCases";
import { createTradingBotUseCases } from "./createTradingBotUseCases";

/** Production server composition root backed by Prisma/PostgreSQL. */
export const postgresRepositories = {
  userCredentialRepository: new PrismaUserCredentialRepository(prisma),
  pairRepository: new PrismaPairRepository(prisma),
  transactionRepository: new PrismaTransactionRepository(prisma),
  transactionGroupRepository: new PrismaTransactionGroupRepository(prisma),
  botRepository: new PrismaBotRepository(prisma),
  botRunRepository: new PrismaBotRunRepository(prisma),
  botTradingRecordRepository: new PrismaBotTradingRecordRepository(prisma),
  botLifecycleRepository: new PrismaBotLifecycleRepository(prisma),
  botBudgetRepository: new PrismaBotBudgetRepository(prisma),
  candleRepository: new PrismaCandleRepository(prisma),
  strategyRepository: new PrismaStrategyRepository(prisma),
  strategyEvaluationRepository: new PrismaStrategyEvaluationRepository(prisma),
  backtestRunPersistenceRepository: new PrismaBacktestRunPersistenceRepository(prisma),
};

export const databaseHealthCheck = new PrismaHealthCheck(prisma);
export const postgresUseCases = createUseCases(postgresRepositories);
export const tradingBotUseCases = createTradingBotUseCases(postgresRepositories);
export const serverUseCases = createServerUseCasesFromRepositories(
  postgresRepositories,
  new JwtAuthTokenService()
);
