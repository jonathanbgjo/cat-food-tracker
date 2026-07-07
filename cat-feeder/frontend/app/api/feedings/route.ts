import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET /api/feedings
// Returns a compact summary for the device:
//   { last_fed_at: string | null, today_count: number, recent: [...] }
// today_count counts feedings since the start of the current New York day.
export async function GET() {
  // most recent feeding (any type)
  const { data: latest, error: latestErr } = await supabase
    .from("feedings")
    .select("fed_at, meal_type")
    .order("fed_at", { ascending: false })
    .limit(1);

  if (latestErr) {
    return NextResponse.json({ error: latestErr.message }, { status: 500 });
  }

  // count of feedings since start of current New York day.
  // We compute the NY-midnight boundary in JS as a UTC instant, then filter.
  const nyMidnightUtc = startOfNewYorkDayUtc();

  const { count, error: countErr } = await supabase
    .from("feedings")
    .select("*", { count: "exact", head: true })
    .gte("fed_at", nyMidnightUtc);

  if (countErr) {
    return NextResponse.json({ error: countErr.message }, { status: 500 });
  }

  return NextResponse.json({
    last_fed_at: latest && latest.length > 0 ? latest[0].fed_at : null,
    today_count: count ?? 0,
  });
}

// POST /api/feedings  { meal_type: "raw" | "wet" }
export async function POST(req: Request) {
  const body = await req.json();
  const { meal_type } = body;

  if (!["raw", "wet"].includes(meal_type)) {
    return NextResponse.json({ error: "Invalid meal_type" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("feedings")
    .insert([{ meal_type }])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

// Returns the UTC ISO string for 00:00 of the current day in America/New_York.
// Uses Intl to get NY's current wall-clock date, then reconstructs midnight
// and converts back to a UTC instant. Handles EST/EDT automatically.
function startOfNewYorkDayUtc(): string {
  const now = new Date();

  // What is today's date in New York, right now?
  const nyParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const y = nyParts.find((p) => p.type === "year")!.value;
  const m = nyParts.find((p) => p.type === "month")!.value;
  const d = nyParts.find((p) => p.type === "day")!.value;

  // Determine NY's UTC offset in minutes for this date by comparing
  // the same instant formatted in NY vs UTC.
  const offsetMin = newYorkOffsetMinutes(now);

  // NY midnight as a UTC instant: local midnight + offset back to UTC.
  // offsetMin is minutes to ADD to UTC to get NY time (negative: e.g. -240).
  // So UTC = localMidnight - offset.
  const localMidnightMs = Date.parse(`${y}-${m}-${d}T00:00:00Z`);
  const utcMs = localMidnightMs - offsetMin * 60 * 1000;
  return new Date(utcMs).toISOString();
}

// Minutes to add to UTC to get New York time (e.g. EDT = -240, EST = -300).
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
  const parts = dtf.formatToParts(at);
  const map: Record<string, number> = {};
  for (const p of parts) {
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
  // difference between NY-wall-clock-as-if-UTC and the real instant
  return Math.round((asUtc - at.getTime()) / 60000);
}
