import { JwtAuthTokenService } from "@/src/modules/auth/infrastructure/JwtAuthTokenService";
import { PrismaUserCredentialRepository } from "@/src/modules/auth/infrastructure/prisma/PrismaUserCredentialRepository";
import { PrismaPairRepository } from "@/src/modules/pair/infrastructure/prisma/PrismaPairRepository";
import { PrismaTransactionRepository } from "@/src/modules/transaction/infrastructure/prisma/PrismaTransactionRepository";
import { PrismaTransactionGroupRepository } from "@/src/modules/transaction-group/infrastructure/prisma/PrismaTransactionGroupRepository";
import { PrismaHealthCheck } from "@/src/shared/infrastructure/prisma/PrismaHealthCheck";
import { prisma } from "@/src/shared/infrastructure/prisma/prisma";
import { createUseCases } from "./createUseCases";
import { createServerUseCasesFromRepositories } from "./createServerUseCases";

/** Production server composition root backed by Prisma/PostgreSQL. */
export const postgresRepositories = {
  userCredentialRepository: new PrismaUserCredentialRepository(prisma),
  pairRepository: new PrismaPairRepository(prisma),
  transactionRepository: new PrismaTransactionRepository(prisma),
  transactionGroupRepository: new PrismaTransactionGroupRepository(prisma),
};

export const databaseHealthCheck = new PrismaHealthCheck(prisma);
export const postgresUseCases = createUseCases(postgresRepositories);
export const serverUseCases = createServerUseCasesFromRepositories(
  postgresRepositories,
  new JwtAuthTokenService()
);
