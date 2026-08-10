import { getPublicSettings } from "@/lib/settings";
import SettingsForm from "./SettingsForm";

export default async function AdminSettingsPage() {
  const settings = await getPublicSettings();
  return (
    <div className="space-y-4">
      <h1 className="font-serif text-3xl font-semibold text-navy">Configurações</h1>
      <SettingsForm initialFeeCents={settings.feeCents} initialPrayerGroupUrl={settings.prayerGroupUrl ?? ""} />
    </div>
  );
}
