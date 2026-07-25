import { createTransactionsReadHandler } from "@/src/modules/transaction/infrastructure/http/transactionsReadHandler";
import { serverUseCases } from "@/src/shared/composition/serverUseCases";
import { withAuth } from "@/utils/auth";

export default withAuth(createTransactionsReadHandler(serverUseCases));
