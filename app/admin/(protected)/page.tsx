import { prisma } from "@/lib/prisma";
import { formatBRL } from "@/lib/fee";

export default async function AdminDashboardPage() {
  const [supportersCount, paidDonations, activeSubscriptions, pendingSubscriptions] = await Promise.all([
    prisma.supporter.count(),
    prisma.donation.aggregate({ where: { status: "PAID" }, _sum: { totalAmount: true }, _count: true }),
    prisma.subscription.aggregate({ where: { status: "ACTIVE" }, _sum: { totalAmount: true }, _count: true }),
    prisma.subscription.count({ where: { status: "PENDING_AUTHORIZATION" } }),
  ]);

  const cards = [
    { label: "Apoiadores cadastrados", value: supportersCount.toLocaleString("pt-BR") },
    { label: "Doações confirmadas", value: paidDonations._count.toLocaleString("pt-BR") },
    { label: "Total recebido em doações", value: formatBRL(paidDonations._sum.totalAmount ?? 0) },
    { label: "Mantenedores ativos", value: activeSubscriptions._count.toLocaleString("pt-BR") },
    { label: "Receita mensal recorrente", value: formatBRL(activeSubscriptions._sum.totalAmount ?? 0) },
    { label: "Aguardando autorização do Pix Automático", value: pendingSubscriptions.toLocaleString("pt-BR") },
  ];

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl font-semibold text-navy">Painel</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-gold/30 bg-white p-5 shadow-sm">
            <p className="text-sm text-muted">{card.label}</p>
            <p className="mt-2 font-serif text-2xl font-semibold text-navy">{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
