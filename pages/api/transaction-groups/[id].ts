import { createTransactionGroupsReadHandler } from "@/src/modules/transaction-group/infrastructure/http/transactionGroupsReadHandler";
import { postgresReadUseCases, serverRepositories, serverUseCases } from "@/src/shared/composition/serverUseCases";
import { selectDataSourceHandler } from "@/src/shared/infrastructure/http/selectDataSourceHandler";
import { withAuth } from "@/utils/auth";

export default withAuth(selectDataSourceHandler(
  createTransactionGroupsReadHandler(serverUseCases, serverRepositories.transactionGroupRepository),
  createTransactionGroupsReadHandler(postgresReadUseCases)
));
