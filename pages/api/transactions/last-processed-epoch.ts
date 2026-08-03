import { createTransactionEpochHandler } from "@/src/modules/transaction/infrastructure/http/transactionEpochHandler";
import { postgresReadRepositories, serverRepositories } from "@/src/shared/composition/serverUseCases";
import { selectDataSourceHandler } from "@/src/shared/infrastructure/http/selectDataSourceHandler";
import { withAuth } from "@/utils/auth";

export default withAuth(
  selectDataSourceHandler(
    createTransactionEpochHandler(serverRepositories.transactionRepository),
    createTransactionEpochHandler(postgresReadRepositories.transactionRepository)
  )
);
