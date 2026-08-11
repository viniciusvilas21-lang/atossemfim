import { prisma } from "@/lib/prisma";
import { formatBRL } from "@/lib/fee";
import { formatCPF } from "@/lib/cpf";

export default async function AdminSupportersPage() {
  const supporters = await prisma.supporter.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      donations: { select: { status: true, totalAmount: true } },
      subscriptions: { select: { status: true, totalAmount: true } },
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-3xl font-semibold text-navy">Apoiadores</h1>
      <div className="overflow-x-auto rounded-2xl border border-gold/30 bg-white shadow-sm">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-navy text-cream">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">WhatsApp</th>
              <th className="px-4 py-3">Instagram</th>
              <th className="px-4 py-3">E-mail</th>
              <th className="px-4 py-3">CPF</th>
              <th className="px-4 py-3">Tipo de apoio</th>
              <th className="px-4 py-3">Divulgar nome</th>
              <th className="px-4 py-3">Cadastro</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gold/20">
            {supporters.map((s) => {
              const donationTotal = s.donations
                .filter((d) => d.status === "PAID")
                .reduce((acc, d) => acc + d.totalAmount, 0);
              const hasActiveSubscription = s.subscriptions.some((sub) => sub.status === "ACTIVE");
              return (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-medium text-ink">{s.fullName}</td>
                  <td className="px-4 py-3">{s.whatsapp}</td>
                  <td className="px-4 py-3">{s.instagram || "—"}</td>
                  <td className="px-4 py-3">{s.email}</td>
                  <td className="px-4 py-3">{s.cpf ? formatCPF(s.cpf) : "—"}</td>
                  <td className="px-4 py-3">
                    {hasActiveSubscription ? "Mantenedor" : donationTotal > 0 ? "Doador" : "Cadastrado"}
                    {donationTotal > 0 && (
                      <span className="ml-1 text-muted">({formatBRL(donationTotal)})</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{s.allowPublicDisplay ? "Sim" : "Não"}</td>
                  <td className="px-4 py-3 text-muted">
                    {s.createdAt.toLocaleDateString("pt-BR")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
