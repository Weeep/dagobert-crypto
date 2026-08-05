import { createPairsReadHandler } from "@/src/modules/pair/infrastructure/http/pairsReadHandler";
import { postgresReadRepositories, postgresReadUseCases, serverRepositories, serverUseCases } from "@/src/shared/composition/serverUseCases";
import { selectDataSourceHandler } from "@/src/shared/infrastructure/http/selectDataSourceHandler";
import { withAuth } from "@/utils/auth";

export default withAuth(selectDataSourceHandler(
  createPairsReadHandler(serverUseCases, serverRepositories.pairRepository),
  createPairsReadHandler(postgresReadUseCases, postgresReadRepositories.pairRepository),
  { postgresWritesEnabled: true }
));
