import { kv } from "@/utils/kv";
import { createServerRepositories } from "./createServerUseCases";
import { createUseCases } from "./createUseCases";

/**
 * Server composition root. API routes can use the singleton today, while tests
 * can inject an in-memory store through the factory.
 */
export const serverRepositories = createServerRepositories(kv);
export const serverUseCases = createUseCases(serverRepositories);
