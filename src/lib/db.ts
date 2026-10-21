import postgres from "postgres";
import { env } from "./env";

const globalForDb = globalThis as unknown as {
  __aigcSql?: ReturnType<typeof postgres>;
};

export const sql =
  globalForDb.__aigcSql ??
  postgres(env.databaseUrl, {
    max: Number(process.env.DB_POOL_SIZE || 10),
    idle_timeout: 30,
    connect_timeout: 15,
    onnotice: () => {},
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__aigcSql = sql;
}

/**
 * Serialize a plain JS value into a jsonb parameter.
 * postgres.js types only accept `JSONValue`, so we cast at the boundary.
 */
export function jsonb(value: unknown) {
  return sql.json(value as unknown as postgres.JSONValue);
}
