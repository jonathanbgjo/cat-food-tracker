"use client";

import { Feeding } from "@/lib/supabase";

type Props = {
  feedings: Feeding[];
};

export default function FeedingLog({ feedings }: Props) {
  return (
    <div className="feeding-log">
      <h2>History</h2>
      {feedings.length === 0 && <p className="empty">No feedings logged yet.</p>}
      <ul>
        {feedings.map((f) => (
          <li key={f.id} className={`log-entry ${f.meal_type}`}>
            <span className="pill">{f.meal_type}</span>
            <span className="log-time">
              {new Date(f.fed_at).toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
