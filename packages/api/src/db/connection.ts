import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env["DATABASE_URL"] ?? "postgres://tig:tig@localhost:5432/tig";

const sql = postgres(connectionString);

export const db = drizzle(sql, { schema });
export { sql };
export type Database = typeof db;
