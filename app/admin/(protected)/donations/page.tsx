import { prisma } from "@/lib/prisma";
import { formatBRL } from "@/lib/fee";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Aguardando pagamento",
  PAID: "Confirmada",
  EXPIRED: "Expirada",
  FAILED: "Falhou",
};

export default async function AdminDonationsPage() {
  const donations = await prisma.donation.findMany({
    orderBy: { createdAt: "desc" },
    include: { supporter: { select: { fullName: true, email: true } } },
    take: 500,
  });

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-3xl font-semibold text-navy">Doações</h1>
      <div className="overflow-x-auto rounded-2xl border border-gold/30 bg-white shadow-sm">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-navy text-cream">
            <tr>
              <th className="px-4 py-3">Apoiador</th>
              <th className="px-4 py-3">Oferta</th>
              <th className="px-4 py-3">Taxa</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Cobrança OpenPix</th>
              <th className="px-4 py-3">Data</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gold/20">
            {donations.map((d) => (
              <tr key={d.id}>
                <td className="px-4 py-3 font-medium text-ink">
                  {d.supporter.fullName}
                  <div className="text-xs text-muted">{d.supporter.email}</div>
                </td>
                <td className="px-4 py-3">{formatBRL(d.amount)}</td>
                <td className="px-4 py-3">{formatBRL(d.fee)}</td>
                <td className="px-4 py-3 font-medium">{formatBRL(d.totalAmount)}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      d.status === "PAID"
                        ? "rounded-full bg-green-100 px-2 py-1 text-xs text-green-700"
                        : d.status === "PENDING"
                          ? "rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-700"
                          : "rounded-full bg-red-100 px-2 py-1 text-xs text-red-700"
                    }
                  >
                    {STATUS_LABEL[d.status] ?? d.status}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted">{d.openpixCorrelationId}</td>
                <td className="px-4 py-3 text-muted">{d.createdAt.toLocaleString("pt-BR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
