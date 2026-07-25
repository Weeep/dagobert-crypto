import { kv } from "@/utils/kv";
import { createServerUseCases } from "./createServerUseCases";

/**
 * Server composition root. API routes can use the singleton today, while tests
 * can inject an in-memory store through the factory.
 */
export const serverUseCases = createServerUseCases(kv);
