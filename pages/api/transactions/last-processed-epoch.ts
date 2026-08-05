import { createTransactionEpochHandler } from "@/src/modules/transaction/infrastructure/http/transactionEpochHandler";
import { postgresRepositories } from "@/src/shared/composition/serverUseCases";
import { withAuth } from "@/utils/auth";

export default withAuth(
  createTransactionEpochHandler(postgresRepositories.transactionRepository)
);
