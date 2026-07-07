import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Presses closer together than this are treated as ONE feeding event,
// so boot glitches or double-taps don't inflate the count.
const DEDUPE_WINDOW_MS = 2 * 60 * 1000; // 2 minutes

// GET /api/summary
// -> { last_fed_at: string | null, today_count: number }
// today_count = distinct feeding events since the start of the current NY day.
export async function GET() {
  const nyMidnightUtc = startOfNewYorkDayUtc();

  // pull today's rows (ascending) and collapse bursts into events
  const { data, error } = await supabase
    .from("feedings")
    .select("fed_at")
    .gte("fed_at", nyMidnightUtc)
    .order("fed_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let todayCount = 0;
  let lastEventMs = -Infinity;
  let lastFedAt: string | null = null;

  for (const row of data ?? []) {
    const t = Date.parse(row.fed_at);
    if (t - lastEventMs > DEDUPE_WINDOW_MS) {
      todayCount++;
    }
    lastEventMs = t;
    lastFedAt = row.fed_at; // ascending, so this ends on the newest today
  }

  // If nothing today, last_fed_at should still reflect the most recent feeding ever,
  // so the "Fed Xh ago" line is meaningful across midnight / quiet days.
  if (!lastFedAt) {
    const { data: latest } = await supabase
      .from("feedings")
      .select("fed_at")
      .order("fed_at", { ascending: false })
      .limit(1);
    lastFedAt = latest && latest.length > 0 ? latest[0].fed_at : null;
  }

  return NextResponse.json({
    last_fed_at: lastFedAt,
    today_count: todayCount,
  });
}

// UTC ISO for 00:00 today in America/New_York (handles EST/EDT automatically).
function startOfNewYorkDayUtc(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;

  const offsetMin = newYorkOffsetMinutes(now);
  const localMidnightMs = Date.parse(`${y}-${m}-${d}T00:00:00Z`);
  const utcMs = localMidnightMs - offsetMin * 60 * 1000;
  return new Date(utcMs).toISOString();
}

// Minutes to add to UTC to get NY time (EDT = -240, EST = -300).
function newYorkOffsetMinutes(at: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map: Record<string, number> = {};
  for (const p of dtf.formatToParts(at)) {
    if (p.type !== "literal") map[p.type] = parseInt(p.value, 10);
  }
  const asUtc = Date.UTC(
    map.year,
    map.month - 1,
    map.day,
    map.hour,
    map.minute,
    map.second
  );
  return Math.round((asUtc - at.getTime()) / 60000);
}
