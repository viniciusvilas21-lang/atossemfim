import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import SubscriptionFlow from "@/components/flows/SubscriptionFlow";

export const metadata: Metadata = { title: "Torne-se mantenedor | Canto da Esperança" };

export default function ApoioMensalPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-cream">
        <SubscriptionFlow />
      </main>
      <SiteFooter />
    </>
  );
}
