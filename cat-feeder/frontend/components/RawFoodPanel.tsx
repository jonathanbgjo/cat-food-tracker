"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Inventory, LOW_STOCK_PCT, OZ_PER_LB } from "@/lib/inventory";

type Props = {
  inventory: Inventory | null;
};

const lb = (oz: number) => (oz / OZ_PER_LB).toFixed(1);

export default function RawFoodPanel({ inventory }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("20");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("Enter an amount in lb");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/restock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount_lb: amt, password }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      setPassword("");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  const pct = inventory ? Math.max(0, Math.min(100, inventory.percent)) : 0;
  const low = inventory ? inventory.percent <= LOW_STOCK_PCT : false;

  return (
    <div className="rawfood">
      <div className="rawfood-head">
        <h2>Raw food</h2>
        <button className="restock-btn" onClick={() => setOpen((o) => !o)}>
          {open ? "Cancel" : "Restock"}
        </button>
      </div>

      {inventory ? (
        <>
          <div className="rawfood-stat">
            <span className={`rawfood-amount ${low ? "low" : ""}`}>
              {lb(inventory.remainingOz)}
              <span className="unit">lb left</span>
            </span>
            <span className="rawfood-pct">
              {Math.round(inventory.percent)}% · {inventory.rawSince} raw feedings since restock
            </span>
          </div>
          <div className="rawfood-bar">
            <div
              className={`rawfood-fill ${low ? "low" : ""}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {low && <p className="rawfood-warn">Running low — time to restock soon.</p>}
        </>
      ) : (
        <p className="rawfood-empty">No raw food tracked yet — hit Restock to set the amount.</p>
      )}

      {open && (
        <form className="restock-form" onSubmit={submit}>
          <label className="restock-field">
            <span>Amount</span>
            <div className="restock-amount">
              <input
                type="number"
                step="0.5"
                min="0"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <span className="unit">lb</span>
            </div>
          </label>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="off"
          />
          <button type="submit" className="save-btn" disabled={saving}>
            {saving ? "…" : "Log restock"}
          </button>
          {error && <span className="form-error">{error}</span>}
        </form>
      )}
    </div>
  );
}
