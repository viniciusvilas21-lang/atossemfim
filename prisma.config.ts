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
    url: process.env.DATABASE_URL,
  },
});
