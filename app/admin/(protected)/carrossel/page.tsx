import { prisma } from "@/lib/prisma";
import CarouselTable from "./CarouselTable";

export default async function AdminCarrosselPage() {
  const supporters = await prisma.supporter.findMany({
    where: { allowPublicDisplay: true },
    orderBy: { createdAt: "desc" },
    include: {
      donations: { where: { status: "PAID" }, select: { id: true }, take: 1 },
      subscriptions: { where: { status: "ACTIVE" }, select: { id: true }, take: 1 },
    },
  });

  const rows = supporters.map((s) => ({
    id: s.id,
    fullName: s.fullName,
    displayName: s.displayName,
    allowPublicDisplay: s.allowPublicDisplay,
    carouselOverride: s.carouselOverride,
    eligibleAutomatically: s.donations.length > 0 || s.subscriptions.length > 0,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-navy">Carrossel de apoiadores</h1>
        <p className="text-sm text-muted">
          Apenas apoiadores que autorizaram a divulgação do nome aparecem aqui. &quot;Elegível
          automaticamente&quot; significa que já existe um pagamento confirmado (doação paga ou
          apoio mensal ativo).
        </p>
      </div>
      <CarouselTable initialRows={rows} />
    </div>
  );
}
