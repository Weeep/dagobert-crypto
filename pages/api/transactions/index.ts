import { createTransactionsReadHandler } from "@/src/modules/transaction/infrastructure/http/transactionsReadHandler";
import { serverRepositories, serverUseCases } from "@/src/shared/composition/serverUseCases";
import { withAuth } from "@/utils/auth";

export default withAuth(createTransactionsReadHandler(serverUseCases, serverRepositories.transactionRepository));
