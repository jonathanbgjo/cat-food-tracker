"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATS, CatName, Weight } from "@/lib/supabase";

type Props = {
  weights: Weight[];
};

const G_PER_LB = 453.59237;
const lbs = (grams: number) => (grams / G_PER_LB).toFixed(1);

function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86400000;
}

// Latest weigh-in vs the most recent one at least ~a week earlier.
function trendFor(entries: Weight[]) {
  if (entries.length === 0) return null; // entries are sorted newest-first
  const latest = entries[0];

  const prior =
    entries.slice(1).find((e) => daysBetween(latest.weighed_at, e.weighed_at) >= 6) ??
    entries[1];

  if (!prior) return { latest, prior: null, pct: null, gapDays: 0 };

  const pct = ((latest.grams - prior.grams) / prior.grams) * 100;
  const gapDays = Math.round(daysBetween(latest.weighed_at, prior.weighed_at));
  return { latest, prior, pct, gapDays };
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function CatCard({ cat, label, entries }: { cat: CatName; label: string; entries: Weight[] }) {
  const [open, setOpen] = useState(false);
  const trend = trendFor(entries);

  return (
    <div className={`cat-card ${cat}`}>
      <button className="cat-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="cat-name">{label}</span>
        {trend ? (
          <span className="cat-weight">
            {lbs(trend.latest.grams)}
            <span className="unit">lb</span>
          </span>
        ) : (
          <span className="cat-weight muted">—</span>
        )}
      </button>

      {trend && trend.pct !== null ? (
        <div className={`cat-trend ${trend.pct > 0 ? "up" : trend.pct < 0 ? "down" : "flat"}`}>
          <span className="arrow">{trend.pct > 0 ? "▲" : trend.pct < 0 ? "▼" : "→"}</span>
          <span className="pct">
            {trend.pct > 0 ? "+" : ""}
            {trend.pct.toFixed(1)}%
          </span>
          <span className="trend-note">
            vs {lbs(trend.prior!.grams)}lb · {trend.gapDays}d ago
          </span>
        </div>
      ) : (
        <div className="cat-trend flat">
          <span className="trend-note">
            {entries.length ? "need another weigh-in for a trend" : "no weigh-ins yet"}
          </span>
        </div>
      )}

      {entries.length > 0 && (
        <>
          <button className="history-toggle" onClick={() => setOpen((o) => !o)}>
            {open ? "Hide history" : `History (${entries.length})`}
          </button>
          {open && (
            <ul className="weight-history">
              {entries.map((w, i) => {
                const next = entries[i + 1];
                const delta = next ? w.grams - next.grams : null;
                return (
                  <li key={w.id}>
                    <span className="wh-date">{fmtDate(w.weighed_at)}</span>
                    <span className="wh-kg">{lbs(w.grams)}lb</span>
                    {delta !== null && delta !== 0 && (
                      <span className={`wh-delta ${delta > 0 ? "up" : "down"}`}>
                        {delta > 0 ? "+" : ""}
                        {(delta / G_PER_LB).toFixed(2)}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function SyncButton() {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sync() {
    setError(null);
    setStatus(null);
    setSyncing(true);
    try {
      const res = await fetch("/api/whisker/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      const unmatched = data.unmatched?.length
        ? ` · unmatched: ${data.unmatched.join(", ")}`
        : "";
      setStatus(`Synced ${data.upserted} day(s) from Litter-Robot${unmatched}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="weight-sync">
      <button className="sync-btn" onClick={sync} disabled={syncing}>
        {syncing ? "Syncing…" : "⟳ Sync from Litter-Robot"}
      </button>
      {status && <span className="sync-status">{status}</span>}
      {error && <span className="form-error">{error}</span>}
    </div>
  );
}

export default function WeightTracker({ weights }: Props) {
  return (
    <div className="weight-tracker">
      <h2>Weights</h2>
      <div className="cat-cards">
        {CATS.map((c) => (
          <CatCard
            key={c.id}
            cat={c.id}
            label={c.label}
            entries={weights.filter((w) => w.cat === c.id)}
          />
        ))}
      </div>
      <SyncButton />
    </div>
  );
}
