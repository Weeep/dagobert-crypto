import { createPairsReadHandler } from "@/src/modules/pair/infrastructure/http/pairsReadHandler";
import { postgresRepositories, postgresUseCases } from "@/src/shared/composition/serverUseCases";
import { withAuth } from "@/utils/auth";

export default withAuth(
  createPairsReadHandler(postgresUseCases, postgresRepositories.pairRepository)
);
