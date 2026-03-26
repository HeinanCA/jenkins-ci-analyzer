import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db/connection";
import * as schema from "./db/schema";

const IS_PRODUCTION = process.env["NODE_ENV"] === "production";

function getTrustedOrigins(): string[] {
  const frontendUrl = process.env["FRONTEND_URL"];
  if (!frontendUrl && IS_PRODUCTION) {
    throw new Error(
      "FRONTEND_URL environment variable is required in production",
    );
  }
  return (frontendUrl ?? "http://localhost:8090")
    .split(",")
    .map((o) => o.trim());
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },
  advanced: {
    useSecureCookies: IS_PRODUCTION,
  },
  trustedOrigins: getTrustedOrigins(),
});
