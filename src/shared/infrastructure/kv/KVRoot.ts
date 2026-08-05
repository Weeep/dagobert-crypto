/**
 * @deprecated Redis/KV persistence is retained only for legacy migration and
 * comparison tests. New features should use Prisma/PostgreSQL instead.
 */
export enum KVRoot {
  users = "users",
  pairs = "pairs",
  dtransactions = "dtransactions",
  dtransactionGroups = "dtransactionGroups",
}
