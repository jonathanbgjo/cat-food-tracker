"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const MEALS: { type: "raw" | "wet"; label: string }[] = [
  { type: "raw", label: "Raw" },
  { type: "wet", label: "Wet" },
];

export default function LogFeeding() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [meal, setMeal] = useState<"raw" | "wet">("wet");
  const [when, setWhen] = useState(""); // empty = now
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/feedings/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meal_type: meal,
          // datetime-local is local time; send as ISO
          fed_at: when ? new Date(when).toISOString() : undefined,
          password,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      setPassword("");
      setWhen("");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="logfeed">
      <button className="logfeed-toggle" onClick={() => setOpen((o) => !o)}>
        {open ? "Cancel" : "＋ Log a feeding"}
      </button>

      {open && (
        <form className="logfeed-form" onSubmit={submit}>
          <div className="seg-group">
            {MEALS.map((m) => (
              <button
                key={m.type}
                type="button"
                className={`seg ${meal === m.type ? "active" : ""}`}
                onClick={() => setMeal(m.type)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <label className="logfeed-when">
            <span>When (blank = now)</span>
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
            />
          </label>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="off"
          />
          <button type="submit" className="save-btn" disabled={saving}>
            {saving ? "…" : "Log it"}
          </button>
          {error && <span className="form-error">{error}</span>}
        </form>
      )}
    </div>
  );
}
