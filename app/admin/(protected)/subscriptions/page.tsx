import { prisma } from "@/lib/prisma";
import { formatBRL } from "@/lib/fee";

const STATUS_LABEL: Record<string, string> = {
  PENDING_AUTHORIZATION: "Aguardando autorização",
  ACTIVE: "Ativo",
  REJECTED: "Rejeitado",
  CANCELED: "Cancelado",
};

export default async function AdminSubscriptionsPage() {
  const subscriptions = await prisma.subscription.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      supporter: { select: { fullName: true, email: true } },
      charges: { orderBy: { createdAt: "desc" }, take: 6 },
    },
    take: 500,
  });

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-3xl font-semibold text-navy">Mantenedores</h1>
      <div className="overflow-x-auto rounded-2xl border border-gold/30 bg-white shadow-sm">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="bg-navy text-cream">
            <tr>
              <th className="px-4 py-3">Apoiador</th>
              <th className="px-4 py-3">Valor mensal</th>
              <th className="px-4 py-3">Dia</th>
              <th className="px-4 py-3">Início</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Histórico recente</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gold/20">
            {subscriptions.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-3 font-medium text-ink">
                  {s.supporter.fullName}
                  <div className="text-xs text-muted">{s.supporter.email}</div>
                </td>
                <td className="px-4 py-3 font-medium">{formatBRL(s.totalAmount)}</td>
                <td className="px-4 py-3">{s.billingDay}</td>
                <td className="px-4 py-3 text-muted">{s.createdAt.toLocaleDateString("pt-BR")}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      s.status === "ACTIVE"
                        ? "rounded-full bg-green-100 px-2 py-1 text-xs text-green-700"
                        : s.status === "PENDING_AUTHORIZATION"
                          ? "rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-700"
                          : "rounded-full bg-red-100 px-2 py-1 text-xs text-red-700"
                    }
                  >
                    {STATUS_LABEL[s.status] ?? s.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-muted">
                  {s.charges.length === 0
                    ? "sem cobranças ainda"
                    : s.charges
                        .map((c) => `${c.createdAt.toLocaleDateString("pt-BR")}: ${c.status}`)
                        .join(" · ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
