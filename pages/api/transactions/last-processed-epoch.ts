import { createTransactionEpochHandler } from "@/src/modules/transaction/infrastructure/http/transactionEpochHandler";
import { serverRepositories } from "@/src/shared/composition/serverUseCases";
import { withAuth } from "@/utils/auth";

export default withAuth(
  createTransactionEpochHandler(serverRepositories.transactionRepository)
);
