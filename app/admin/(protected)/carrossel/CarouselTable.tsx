"use client";

import { useState } from "react";

export interface CarouselRow {
  id: string;
  fullName: string;
  displayName: string | null;
  allowPublicDisplay: boolean;
  carouselOverride: "AUTO" | "FORCE_SHOW" | "FORCE_HIDE";
  eligibleAutomatically: boolean;
}

export default function CarouselTable({ initialRows }: { initialRows: CarouselRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<Record<string, string>>({});

  async function patch(id: string, body: Record<string, unknown>) {
    setSavingId(id);
    try {
      const res = await fetch(`/api/admin/supporters/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const { supporter } = await res.json();
        setRows((prev) =>
          prev.map((r) =>
            r.id === id
              ? { ...r, displayName: supporter.displayName, carouselOverride: supporter.carouselOverride }
              : r,
          ),
        );
      }
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-gold/30 bg-white shadow-sm">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="bg-navy text-cream">
          <tr>
            <th className="px-4 py-3">Nome</th>
            <th className="px-4 py-3">Nome exibido</th>
            <th className="px-4 py-3">Elegível automaticamente</th>
            <th className="px-4 py-3">Exibição no carrossel</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gold/20">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-4 py-3 font-medium text-ink">{row.fullName}</td>
              <td className="px-4 py-3">
                <input
                  className="w-40 rounded border border-gold/40 px-2 py-1"
                  value={editingName[row.id] ?? row.displayName ?? ""}
                  placeholder="(nome + inicial automático)"
                  onChange={(e) => setEditingName((prev) => ({ ...prev, [row.id]: e.target.value }))}
                  onBlur={() => {
                    const value = editingName[row.id];
                    if (value !== undefined && value !== (row.displayName ?? "")) {
                      patch(row.id, { displayName: value || null });
                    }
                  }}
                />
              </td>
              <td className="px-4 py-3">{row.eligibleAutomatically ? "Sim" : "Não"}</td>
              <td className="px-4 py-3">
                <select
                  className="rounded border border-gold/40 px-2 py-1"
                  value={row.carouselOverride}
                  disabled={savingId === row.id}
                  onChange={(e) => patch(row.id, { carouselOverride: e.target.value })}
                >
                  <option value="AUTO">Automático</option>
                  <option value="FORCE_SHOW">Sempre exibir</option>
                  <option value="FORCE_HIDE">Ocultar</option>
                </select>
              </td>
              <td className="px-4 py-3 text-xs text-muted">{savingId === row.id ? "Salvando..." : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
