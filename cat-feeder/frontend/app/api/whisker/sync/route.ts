import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { fetchWhiskerPets, WeightReading } from "@/lib/whisker";
import { CATS, CatName } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Map a Whisker pet name to one of our cat ids by (case-insensitive) name.
function matchCat(petName: string): CatName | null {
  const n = petName.trim().toLowerCase();
  const hit = CATS.find((c) => c.id === n || c.label.toLowerCase() === n);
  if (hit) return hit.id;
  const sub = CATS.find((c) => n.includes(c.id));
  return sub ? sub.id : null;
}

const median = (nums: number[]): number => {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};

type DayRow = { cat: CatName; grams: number; weighed_at: string; day: string; source: string };

// Reduce noisy per-visit readings to one median point per UTC day.
function dailyPoints(cat: CatName, history: WeightReading[]): DayRow[] {
  const byDay = new Map<string, number[]>();
  for (const r of history) {
    const day = new Date(r.timestamp).toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
    (byDay.get(day) ?? byDay.set(day, []).get(day)!).push(r.grams);
  }
  return Array.from(byDay.entries()).map(([day, grams]) => ({
    cat,
    grams: median(grams),
    day,
    weighed_at: `${day}T12:00:00Z`,
    source: "whisker",
  }));
}

async function sync() {
  const email = process.env.WHISKER_EMAIL;
  const password = process.env.WHISKER_PASSWORD;
  if (!email || !password) {
    return NextResponse.json(
      { error: "WHISKER_EMAIL / WHISKER_PASSWORD not set on the server" },
      { status: 400 }
    );
  }

  let pets;
  try {
    pets = await fetchWhiskerPets(email, password);
  } catch (err) {
    return NextResponse.json(
      { error: `Whisker fetch failed: ${err instanceof Error ? err.message : err}` },
      { status: 502 }
    );
  }

  const rows: DayRow[] = [];
  const matched: Record<string, string> = {};
  const unmatched: string[] = [];

  for (const pet of pets) {
    const cat = matchCat(pet.name);
    if (!cat) {
      unmatched.push(pet.name);
      continue;
    }
    matched[pet.name] = cat;
    rows.push(...dailyPoints(cat, pet.history));
  }

  if (rows.length === 0) {
    return NextResponse.json({
      ok: true,
      upserted: 0,
      matched,
      unmatched,
      note: "No weight history returned for the matched cats.",
    });
  }

  const { error } = await supabase
    .from("weights")
    .upsert(rows, { onConflict: "cat,day" });

  if (error) {
    return NextResponse.json(
      { error: `DB upsert failed: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    upserted: rows.length,
    matched,
    unmatched,
    synced_at: new Date().toISOString(),
  });
}

// GET — used by the Vercel cron. POST — used by the "Sync" button.
export async function GET() {
  return sync();
}
export async function POST() {
  return sync();
}
