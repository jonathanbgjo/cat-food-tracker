import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { OZ_PER_LB } from "@/lib/inventory";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// POST /api/restock — log a raw-food restock. { amount_lb, password }
export async function POST(req: Request) {
  const expected = process.env.RESTOCK_PASSWORD;
  if (!expected) {
    return NextResponse.json({ error: "RESTOCK_PASSWORD not set on the server" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const { amount_lb, password } = body;

  if (password !== expected) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const lb = Number(amount_lb);
  if (!Number.isFinite(lb) || lb <= 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("restocks")
    .insert([{ amount_oz: Math.round(lb * OZ_PER_LB) }])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
