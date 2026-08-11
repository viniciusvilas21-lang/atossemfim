"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const links = [
  { href: "/admin", label: "Painel" },
  { href: "/admin/supporters", label: "Apoiadores" },
  { href: "/admin/donations", label: "Doações" },
  { href: "/admin/subscriptions", label: "Mantenedores" },
  { href: "/admin/carrossel", label: "Carrossel" },
  { href: "/admin/settings", label: "Configurações" },
];

export default function AdminNav({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <header className="border-b border-gold/30 bg-navy text-cream">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <nav className="flex flex-wrap gap-4 text-sm">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                pathname === link.href
                  ? "font-semibold text-gold-lt"
                  : "text-cream/80 hover:text-gold-lt"
              }
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3 text-xs text-cream/70">
          <span>{email}</span>
          <button
            onClick={handleLogout}
            className="rounded-full border border-gold/40 px-3 py-1 text-cream hover:bg-navy-mid"
          >
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}
