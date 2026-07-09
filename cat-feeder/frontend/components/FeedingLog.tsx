"use client";

import { useState } from "react";
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
  const groups = groupByDay(feedings);
  // Today (first group) starts expanded; older days collapsed.
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    groups.length ? { [groups[0].key]: true } : {}
  );

  const toggle = (key: string) =>
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="feeding-log">
      <h2>History</h2>
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
