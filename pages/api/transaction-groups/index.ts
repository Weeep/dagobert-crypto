import { createTransactionGroupsReadHandler } from "@/src/modules/transaction-group/infrastructure/http/transactionGroupsReadHandler";
import { serverRepositories, serverUseCases } from "@/src/shared/composition/serverUseCases";
import { withAuth } from "@/utils/auth";

export default withAuth(createTransactionGroupsReadHandler(serverUseCases, serverRepositories.transactionGroupRepository));
