import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET /api/feedings — recent feedings as an array (used by the webpage)
export async function GET() {
  const { data, error } = await supabase
    .from("feedings")
    .select("*")
    .order("fed_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/feedings — log a feeding (used by the ESP32)
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