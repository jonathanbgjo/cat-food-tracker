"use client";

import { Feeding } from "@/lib/supabase";

type Props = {
  feedings: Feeding[];
};

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export default function Stats({ feedings }: Props) {
  const today = feedings.filter((f) => isToday(f.fed_at));
  const rawToday = today.filter((f) => f.meal_type === "raw").length;
  const wetToday = today.filter((f) => f.meal_type === "wet").length;

  return (
    <div className="stats">
      <div className="stat">
        <span className="stat-value">{today.length}</span>
        <span className="stat-label">fed today</span>
      </div>
      <div className="stat">
        <span className="stat-value raw-text">{rawToday}</span>
        <span className="stat-label">raw</span>
      </div>
      <div className="stat">
        <span className="stat-value wet-text">{wetToday}</span>
        <span className="stat-label">wet</span>
      </div>
    </div>
  );
}
