import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.setting.upsert({
    where: { key: "transaction_fee_cents" },
    create: { key: "transaction_fee_cents", value: "70" },
    update: {},
  });
  await prisma.setting.upsert({
    where: { key: "prayer_group_url" },
    create: { key: "prayer_group_url", value: "" },
    update: {},
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
