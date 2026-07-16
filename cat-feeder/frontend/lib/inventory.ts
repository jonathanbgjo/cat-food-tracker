import type { SupabaseClient } from "@supabase/supabase-js";

export const RAW_FEEDING_OZ = 2; // 1 oz per cat × 2 cats per raw feeding
export const OZ_PER_LB = 16;
export const LOW_STOCK_PCT = 30; // alert when remaining drops to this %

export type Inventory = {
  amountOz: number; // the last restock amount (full baseline)
  remainingOz: number;
  percent: number; // remaining / amount
  rawSince: number; // raw feedings since the last restock
  lastRestockAt: string;
  lowAlertSent: boolean;
  restockId: string;
};

// Current raw-food stock: last restock minus 2oz per raw feeding since then.
// Returns null if nothing has been restocked yet (table empty / missing).
export async function getInventory(client: SupabaseClient): Promise<Inventory | null> {
  const { data: restock, error } = await client
    .from("restocks")
    .select("*")
    .order("restocked_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !restock) return null;

  const { count } = await client
    .from("feedings")
    .select("*", { count: "exact", head: true })
    .eq("meal_type", "raw")
    .gt("fed_at", restock.restocked_at);

  const rawSince = count ?? 0;
  const remainingOz = Math.max(0, restock.amount_oz - rawSince * RAW_FEEDING_OZ);
  const percent = restock.amount_oz > 0 ? (remainingOz / restock.amount_oz) * 100 : 0;

  return {
    amountOz: restock.amount_oz,
    remainingOz,
    percent,
    rawSince,
    lastRestockAt: restock.restocked_at,
    lowAlertSent: restock.low_alert_sent,
    restockId: restock.id,
  };
}

export const lbFromOz = (oz: number) => oz / OZ_PER_LB;
