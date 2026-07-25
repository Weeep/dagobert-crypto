import { databaseHealthCheck } from "@/src/shared/composition/serverUseCases";
import { createDatabaseHealthHandler } from "@/src/shared/infrastructure/http/databaseHealthHandler";
import { withAuth } from "@/utils/auth";

const handler = createDatabaseHealthHandler(() => databaseHealthCheck.isHealthy());

export default withAuth(handler);
