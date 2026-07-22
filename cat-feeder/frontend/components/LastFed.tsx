"use client";

import { Feeding } from "@/lib/supabase";

type Props = {
  feedings: Feeding[];
};

function timeSince(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remH = hours % 24;
    return remH > 0 ? `${days}d ${remH}h ago` : `${days}d ago`;
  }
  if (hours > 0) return `${hours}h ${mins % 60}m ago`;
  if (mins > 0) return `${mins}m ago`;
  return "just now";
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

const MEALS: { type: "raw" | "wet"; label: string }[] = [
  { type: "raw", label: "Raw" },
  { type: "wet", label: "Wet" },
];

export default function LastFed({ feedings }: Props) {
  const totalToday = feedings.filter((f) => isToday(f.fed_at)).length;

  return (
    <div className="status">
      <p className="today-total">
        <strong>{totalToday}</strong> {totalToday === 1 ? "feeding" : "feedings"} today
      </p>
      <div className="last-fed">
        {MEALS.map(({ type, label }) => {
          const last = feedings.find((f) => f.meal_type === type);
          const countToday = feedings.filter(
            (f) => f.meal_type === type && isToday(f.fed_at)
          ).length;
          return (
            <div key={type} className={`meal-card ${type}`}>
              <div className="meal-head">
                <span className="label">{label}</span>
                <span className="today-badge">{countToday} today</span>
              </div>
              <span className="time">{last ? timeSince(last.fed_at) : "never"}</span>
              {last && (
                <span className="timestamp">
                  {new Date(last.fed_at).toLocaleString()}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
