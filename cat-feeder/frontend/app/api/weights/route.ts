import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET /api/weights — recent weigh-ins for both cats
export async function GET() {
  const { data, error } = await supabase
    .from("weights")
    .select("*")
    .order("weighed_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/weights — log a weigh-in { cat: 'umi'|'ebi', grams: number }
export async function POST(req: Request) {
  const body = await req.json();
  const { cat, grams } = body;

  if (!["umi", "ebi"].includes(cat)) {
    return NextResponse.json({ error: "Invalid cat" }, { status: 400 });
  }
  const g = Number(grams);
  if (!Number.isFinite(g) || g <= 0) {
    return NextResponse.json({ error: "Invalid grams" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("weights")
    .insert([{ cat, grams: Math.round(g) }])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
