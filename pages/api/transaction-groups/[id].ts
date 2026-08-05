import { createTransactionGroupsReadHandler } from "@/src/modules/transaction-group/infrastructure/http/transactionGroupsReadHandler";
import { postgresRepositories, postgresUseCases } from "@/src/shared/composition/serverUseCases";
import { withAuth } from "@/utils/auth";

export default withAuth(
  createTransactionGroupsReadHandler(
    postgresUseCases,
    postgresRepositories.transactionGroupRepository
  )
);
