"use client";

import { useState } from "react";
import { todayPK } from "@/lib/datetime";
import { ErrorText } from "@/components/ui";

type Kind = "attendance" | "reports";

const LABELS: Record<Kind, string> = {
  attendance: "Attendance CSV",
  reports: "Reports CSV",
};

// Downloads a month (or any range up to 92 days) as a CSV that opens in Excel.
export function ExportPanel({
  kinds,
  filters,
}: {
  kinds: Kind[];
  filters?: { projectId?: string; employeeId?: string };
}) {
  const today = todayPK();
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState<Kind | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function download(kind: Kind) {
    setBusy(kind);
    setError(null);
    try {
      const params = new URLSearchParams({ from, to });
      if (filters?.projectId) params.set("projectId", filters.projectId);
      if (kind === "reports" && filters?.employeeId) params.set("employeeId", filters.employeeId);
      const res = await fetch(`/api/admin/export/${kind}?${params}`, { cache: "no-store" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Export failed");
      }
      const blob = await res.blob();
      const name =
        res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ||
        `helpline-${kind}_${from}_to_${to}.csv`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card mb-6 px-5 py-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <p className="font-semibold">Export</p>
          <p className="text-xs text-muted">Download a date range as a CSV file for Excel.</p>
        </div>
        <label className="ml-auto text-xs font-bold uppercase tracking-wider text-muted">
          From
          <input className="input mt-1" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-xs font-bold uppercase tracking-wider text-muted">
          To
          <input className="input mt-1" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </label>
        {kinds.map((kind) => (
          <button
            key={kind}
            className="btn btn-ghost"
            type="button"
            disabled={busy !== null || !from || !to}
            onClick={() => download(kind)}
          >
            {busy === kind ? "Preparing…" : LABELS[kind]}
          </button>
        ))}
      </div>
      {error ? (
        <div className="mt-3">
          <ErrorText message={error} />
        </div>
      ) : null}
    </div>
  );
}
