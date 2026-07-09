import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Feeding = {
  id: string;
  fed_at: string;
  meal_type: "raw" | "wet";
};

export type CatName = "umi" | "ebi";

export const CATS: { id: CatName; label: string }[] = [
  { id: "umi", label: "Umi" },
  { id: "ebi", label: "Ebi" },
];

export type Weight = {
  id: string;
  cat: CatName;
  grams: number;
  weighed_at: string;
};
