import { createTransactionsReadHandler } from "@/src/modules/transaction/infrastructure/http/transactionsReadHandler";
import { postgresReadRepositories, postgresReadUseCases, serverRepositories, serverUseCases } from "@/src/shared/composition/serverUseCases";
import { selectDataSourceHandler } from "@/src/shared/infrastructure/http/selectDataSourceHandler";
import { withAuth } from "@/utils/auth";

export default withAuth(selectDataSourceHandler(
  createTransactionsReadHandler(serverUseCases, serverRepositories.transactionRepository),
  createTransactionsReadHandler(postgresReadUseCases, postgresReadRepositories.transactionRepository),
  { postgresWritesEnabled: true }
));
