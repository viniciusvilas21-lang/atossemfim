import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Matches OpenPix/Woovi's "Pix Recebido" plan: 0,80% por pagamento, mínimo
// de R$ 0,50, máximo de R$ 5,00.
const DEFAULTS: Record<string, string> = {
  fee_percentage_basis_points: "80",
  fee_min_cents: "50",
  fee_max_cents: "500",
  prayer_group_url: "",
};

async function main() {
  for (const [key, value] of Object.entries(DEFAULTS)) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value },
      update: {},
    });
  }
  // Superseded by the percentage-based fee formula above.
  await prisma.setting.deleteMany({ where: { key: "transaction_fee_cents" } });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
