import { createPairsReadHandler } from "@/src/modules/pair/infrastructure/http/pairsReadHandler";
import { serverRepositories, serverUseCases } from "@/src/shared/composition/serverUseCases";
import { withAuth } from "@/utils/auth";

export default withAuth(createPairsReadHandler(serverUseCases, serverRepositories.pairRepository));
