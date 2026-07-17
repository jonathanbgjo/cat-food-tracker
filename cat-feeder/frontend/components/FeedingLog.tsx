"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Feeding } from "@/lib/supabase";

type Props = {
  feedings: Feeding[];
};

// Label a date as "Today" / "Yesterday" / "Mon, Jul 7"
function dayLabel(d: Date): string {
  const today = new Date();
  const startOf = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(today) - startOf(d)) / 86400000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

type DayGroup = {
  key: string;
  label: string;
  entries: Feeding[];
  raw: number;
  wet: number;
};

function groupByDay(feedings: Feeding[]): DayGroup[] {
  const groups = new Map<string, DayGroup>();

  for (const f of feedings) {
    const d = new Date(f.fed_at);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    let g = groups.get(key);
    if (!g) {
      g = { key, label: dayLabel(d), entries: [], raw: 0, wet: 0 };
      groups.set(key, g);
    }
    g.entries.push(f);
    if (f.meal_type === "raw") g.raw++;
    else g.wet++;
  }

  return Array.from(groups.values());
}

function timeOfDay(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function FeedingLog({ feedings }: Props) {
  const router = useRouter();
  const groups = groupByDay(feedings);
  // Today (first group) starts expanded; older days collapsed.
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    groups.length ? { [groups[0].key]: true } : {}
  );
  const [editing, setEditing] = useState(false);
  const [password, setPassword] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = (key: string) =>
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  async function remove(id: string) {
    if (!password) {
      setError("Enter the password first");
      return;
    }
    setError(null);
    setBusyId(id);
    try {
      const res = await fetch("/api/feedings/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, password }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="feeding-log">
      <div className="log-head">
        <h2>History</h2>
        {feedings.length > 0 && (
          <button
            className="edit-toggle"
            onClick={() => {
              setEditing((e) => !e);
              setError(null);
            }}
          >
            {editing ? "Done" : "Edit"}
          </button>
        )}
      </div>

      {editing && (
        <div className="edit-bar">
          <input
            type="password"
            placeholder="Password to delete"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="off"
          />
          {error && <span className="form-error">{error}</span>}
        </div>
      )}

      {feedings.length === 0 && (
        <p className="empty">No feedings logged yet.</p>
      )}

      <div className="day-groups">
        {groups.map((g) => {
          const isOpen = open[g.key] ?? false;
          return (
            <div key={g.key} className="day-group">
              <button
                className="day-header"
                onClick={() => toggle(g.key)}
                aria-expanded={isOpen}
              >
                <span className={`chevron ${isOpen ? "open" : ""}`}>▶</span>
                <span className="day-label">{g.label}</span>
                <span className="day-meta">
                  {g.raw > 0 && <span className="tag raw">{g.raw} raw</span>}
                  {g.wet > 0 && <span className="tag wet">{g.wet} wet</span>}
                  <span className="day-count">{g.entries.length}</span>
                </span>
              </button>

              {isOpen && (
                <ul className="day-entries">
                  {g.entries.map((f) => (
                    <li key={f.id} className={`log-entry ${f.meal_type}`}>
                      <span className="pill">{f.meal_type}</span>
                      <span className="log-time">{timeOfDay(f.fed_at)}</span>
                      {editing && (
                        <button
                          className="entry-delete"
                          onClick={() => remove(f.id)}
                          disabled={busyId === f.id}
                          title="Delete this feeding"
                        >
                          {busyId === f.id ? "…" : "✕"}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
