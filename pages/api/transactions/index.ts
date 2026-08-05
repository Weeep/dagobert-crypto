import { createTransactionsReadHandler } from "@/src/modules/transaction/infrastructure/http/transactionsReadHandler";
import { postgresRepositories, postgresUseCases } from "@/src/shared/composition/serverUseCases";
import { withAuth } from "@/utils/auth";

export default withAuth(
  createTransactionsReadHandler(
    postgresUseCases,
    postgresRepositories.transactionRepository
  )
);
