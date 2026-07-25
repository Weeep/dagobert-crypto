import { createDatabaseHealthHandler } from "@/src/shared/infrastructure/http/databaseHealthHandler";
import DbApiUtil from "@/utils/dbapiutil";
import { withAuth } from "@/utils/auth";

const handler = createDatabaseHealthHandler(async () => {
  const response = await DbApiUtil.get("__dagobert_healthcheck__");
  return response.ok;
});

export default withAuth(handler);
