import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import DonationFlow from "@/components/flows/DonationFlow";

export const metadata: Metadata = { title: "Doação única | Canto da Esperança" };

export default function DoacaoUnicaPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-cream">
        <DonationFlow />
      </main>
      <SiteFooter />
    </>
  );
}
