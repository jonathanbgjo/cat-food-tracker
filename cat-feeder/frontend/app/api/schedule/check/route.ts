import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { learnSchedule, predictNext, fmtHour, fmtDur } from "@/lib/schedule";
import { getInventory, LOW_STOCK_PCT, lbFromOz } from "@/lib/inventory";
import { sendTelegram } from "@/lib/telegram";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Runs on a schedule (external cron). Learns the feeding schedule, checks whether
// the cats are overdue right now, and — once per missed slot — sends a Telegram
// alert. Returns JSON describing what it did.
async function check(req: Request) {
  // Optional shared-secret gate so random hits can't trigger texts.
  const secret = process.env.CRON_SECRET;
  const url = new URL(req.url);
  if (secret) {
    const provided =
      url.searchParams.get("key") ||
      (req.headers.get("authorization") || "").replace("Bearer ", "");
    if (provided !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  // ?test=1 — send a one-off message to confirm the Telegram wiring works.
  if (url.searchParams.get("test") === "1") {
    try {
      await sendTelegram("🐱 Cat Feeder test alert — Telegram is wired up.");
      return NextResponse.json({ ok: true, test: true, sent: true });
    } catch (e) {
      return NextResponse.json(
        { error: `Telegram send failed: ${e instanceof Error ? e.message : e}` },
        { status: 502 }
      );
    }
  }

  // --- Low raw-food stock ---
  let stock: Record<string, unknown> = { tracked: false };
  try {
    const inv = await getInventory(supabase);
    if (inv) {
      stock = { percent: Math.round(inv.percent), alerted: false };
      if (inv.percent <= LOW_STOCK_PCT && !inv.lowAlertSent) {
        await sendTelegram(
          `🥩 <b>Raw food low</b>\n` +
            `~${lbFromOz(inv.remainingOz).toFixed(1)} lb left (${Math.round(inv.percent)}%). Time to restock.`
        );
        await supabase.from("restocks").update({ low_alert_sent: true }).eq("id", inv.restockId);
        stock = { percent: Math.round(inv.percent), alerted: true };
      }
    }
  } catch (e) {
    stock = { error: e instanceof Error ? e.message : String(e) };
  }

  // --- Overdue feeding ---
  const { data: feedings, error } = await supabase
    .from("feedings")
    .select("id, fed_at, meal_type")
    .order("fed_at", { ascending: false })
    .limit(500);
  if (error) {
    return NextResponse.json({ error: error.message, stock }, { status: 500 });
  }

  const schedule = learnSchedule(feedings);
  const pred = predictNext(schedule, feedings, new Date());
  let feeding: Record<string, unknown> = { status: pred.status, alerted: false };

  if (pred.status === "overdue" && pred.slotKey && pred.dueHour !== null) {
    // De-dupe: slot_key is unique, so a duplicate insert (23505) means already sent.
    const { error: insErr } = await supabase
      .from("feeding_alerts")
      .insert([{ slot_key: pred.slotKey }]);
    if (insErr && insErr.code !== "23505") {
      return NextResponse.json({ error: insErr.message, stock }, { status: 500 });
    }
    if (!insErr) {
      const lastLine =
        pred.lastFedHour !== null ? `\nLast fed ~${fmtHour(pred.lastFedHour)}.` : "";
      try {
        await sendTelegram(
          `🐱 <b>Umi &amp; Ebi are overdue</b>\n` +
            `Usually fed by ~${fmtHour(pred.dueHour)} — it's been ${fmtDur(pred.minutes)}.` +
            lastLine
        );
        feeding = { status: "overdue", alerted: true, slotKey: pred.slotKey };
      } catch (e) {
        return NextResponse.json(
          { error: `Telegram send failed: ${e instanceof Error ? e.message : e}`, stock },
          { status: 502 }
        );
      }
    } else {
      feeding = { status: "overdue", alerted: false, note: "already sent" };
    }
  }

  return NextResponse.json({ ok: true, feeding, stock });
}

export async function GET(req: Request) {
  return check(req);
}
export async function POST(req: Request) {
  return check(req);
}
