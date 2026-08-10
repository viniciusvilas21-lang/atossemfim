import SiteHeader from "@/components/SiteHeader";
import Hero from "@/components/Hero";
import SupportersCarousel from "@/components/SupportersCarousel";
import SupportChoice from "@/components/SupportChoice";
import PrayerSection from "@/components/PrayerSection";
import SiteFooter from "@/components/SiteFooter";
import { getPublicSettings } from "@/lib/settings";

// The prayer-group link is admin-editable at runtime (no redeploy), so this
// page must never be frozen into a static build-time snapshot.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { prayerGroupUrl } = await getPublicSettings();

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <SupportersCarousel />
        <SupportChoice />
        <PrayerSection prayerGroupUrl={prayerGroupUrl} />
      </main>
      <SiteFooter />
    </>
  );
}
