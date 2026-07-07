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

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "just now";
}

export default function LastFed({ feedings }: Props) {
  const lastRaw = feedings.find((f) => f.meal_type === "raw");
  const lastWet = feedings.find((f) => f.meal_type === "wet");

  return (
    <div className="last-fed">
      <div className="meal-card raw">
        <span className="label">Raw</span>
        <span className="time">
          {lastRaw ? timeSince(lastRaw.fed_at) : "never"}
        </span>
        {lastRaw && (
          <span className="timestamp">
            {new Date(lastRaw.fed_at).toLocaleString()}
          </span>
        )}
      </div>
      <div className="meal-card wet">
        <span className="label">Wet</span>
        <span className="time">
          {lastWet ? timeSince(lastWet.fed_at) : "never"}
        </span>
        {lastWet && (
          <span className="timestamp">
            {new Date(lastWet.fed_at).toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
}
