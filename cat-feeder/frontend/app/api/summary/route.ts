import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const revalidate = 0;
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET /api/summary -> { last_fed_at, today_count }
// All date/timezone/de-dupe logic lives in the Postgres RPC feeding_summary().
// The ESP32 polls this ~every 60s, so it doubles as a device heartbeat.
export async function GET() {
  // Record the heartbeat. Never let a failure here break the ESP32's poll.
  try {
    await supabase
      .from("device_status")
      .upsert(
        { id: "esp32", last_seen: new Date().toISOString(), offline_alert_sent: false },
        { onConflict: "id" }
      );
  } catch {
    /* device_status table may not exist yet — ignore */
  }

  const { data, error } = await supabase.rpc("feeding_summary");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // rpc returns an array of rows; this function yields exactly one
  const row = Array.isArray(data) ? data[0] : data;

  return NextResponse.json({
    last_fed_at: row?.last_fed_at ?? null,
    today_count: row?.today_count ?? 0,
  });
}
