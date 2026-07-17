import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// POST /api/feedings/manual — log a feeding from the web (password-gated).
// { meal_type: 'raw'|'wet', fed_at?: ISO string, password }
// fed_at lets you backdate a feeding you forgot to log.
export async function POST(req: Request) {
  const expected = process.env.RESTOCK_PASSWORD;
  if (!expected) {
    return NextResponse.json({ error: "RESTOCK_PASSWORD not set on the server" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const { meal_type, fed_at, password } = body;

  if (password !== expected) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }
  if (!["raw", "wet"].includes(meal_type)) {
    return NextResponse.json({ error: "Invalid meal_type" }, { status: 400 });
  }

  const row: { meal_type: string; fed_at?: string } = { meal_type };
  if (fed_at) {
    const d = new Date(fed_at);
    if (isNaN(d.getTime())) {
      return NextResponse.json({ error: "Invalid fed_at" }, { status: 400 });
    }
    row.fed_at = d.toISOString();
  }

  const { data, error } = await supabase.from("feedings").insert([row]).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
