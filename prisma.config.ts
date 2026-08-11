import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Used by the Prisma CLI (migrate/studio/db push) only. The running app
    // connects through the pg driver adapter in lib/prisma.ts instead.
    //
    // Prefer the direct (non-pooled) connection string for migrations:
    // `prisma migrate deploy` takes a Postgres advisory lock, and Neon's
    // pooled connection (PgBouncer, transaction mode) doesn't preserve
    // session state across statements, so the lock can time out (P1002)
    // even though the database itself is reachable. Neon's Vercel
    // integration exposes the direct URL as DATABASE_URL_UNPOOLED; local
    // dev only has DATABASE_URL, so fall back to that.
    url: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
  },
});
