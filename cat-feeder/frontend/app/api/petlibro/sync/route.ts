import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { syncPetLibro } from "@/lib/petlibro";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET/POST /api/petlibro/sync?key=<CRON_SECRET> — log the Polar's auto-feeds as
// wet feedings. Add &debug=1 to see the raw work-record types (logs nothing).
// The schedule-check cron also runs this, so it normally doesn't need its own cron.
async function sync(req: Request) {
  const url = new URL(req.url);
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const provided =
      url.searchParams.get("key") ||
      (req.headers.get("authorization") || "").replace("Bearer ", "");
    if (provided !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await syncPetLibro(supabase, url.searchParams.get("debug") === "1");
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (e) {
    return NextResponse.json(
      { error: `PetLibro sync failed: ${e instanceof Error ? e.message : e}` },
      { status: 502 }
    );
  }
}

export async function GET(req: Request) {
  return sync(req);
}
export async function POST(req: Request) {
  return sync(req);
}
