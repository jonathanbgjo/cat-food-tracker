import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// POST /api/feedings/delete — remove a feeding (undo a mis-press). { id, password }
export async function POST(req: Request) {
  const expected = process.env.RESTOCK_PASSWORD;
  if (!expected) {
    return NextResponse.json({ error: "RESTOCK_PASSWORD not set on the server" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const { id, password } = body;

  if (password !== expected) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { error } = await supabase.from("feedings").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
