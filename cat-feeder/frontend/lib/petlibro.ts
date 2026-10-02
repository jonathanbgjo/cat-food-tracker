import { createHash } from "crypto";
import { TZ } from "@/lib/schedule";

// PetLibro has no official public API. These are the community-reverse-engineered
// endpoints used by the Home Assistant integration (jjjonesjr33/petlibro). They can
// break at any time — treat failures as non-fatal.
//
// NOTE: PetLibro allows one active session per account — logging in here signs the
// phone app out. Use a second PetLibro account that the feeder is shared to.
const BASE_URL = "https://api.us.petlibro.com";
const APP_ID = 1;
const APP_SN = "c35772530d1041699c87fe62348507a8";

const HEADERS = {
  "Content-Type": "application/json",
  source: "ANDROID",
  language: "EN",
  timezone: TZ,
  version: "1.3.45",
};

export type PetLibroDevice = {
  deviceSn: string;
  name: string;
  productName: string;
};

export type WorkRecord = {
  type: string;
  recordTime: number; // epoch ms
  [k: string]: unknown;
};

async function call<T>(path: string, body: unknown, token?: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: token ? { ...HEADERS, token } : HEADERS,
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`PetLibro ${path} ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.code !== 0) {
    throw new Error(`PetLibro ${path} code ${json.code}: ${json.msg ?? "unknown error"}`);
  }
  return json.data as T;
}

// Password is sent as an MD5 hex digest, same as the official app.
export async function login(email: string, password: string): Promise<string> {
  const data = await call<{ token?: string }>("/member/auth/login", {
    appId: APP_ID,
    appSn: APP_SN,
    country: "US",
    email,
    password: createHash("md5").update(password).digest("hex"),
    phoneBrand: "",
    phoneSystemVersion: "",
    timezone: TZ,
    thirdId: null,
    type: null,
  });
  if (!data?.token) throw new Error("PetLibro login returned no token");
  return data.token;
}

export async function listDevices(token: string): Promise<PetLibroDevice[]> {
  const data = await call<PetLibroDevice[]>("/device/device/list", {}, token);
  return data ?? [];
}

// Device activity log, flattened. The API groups records by day:
// [{ workRecords: [{ type, recordTime, ... }] }, ...]
export async function workRecords(
  token: string,
  deviceSn: string,
  since: Date,
  types?: string[]
): Promise<WorkRecord[]> {
  const body: Record<string, unknown> = {
    deviceSn,
    startTime: since.getTime(),
    endTime: Date.now(),
    size: 50,
  };
  if (types?.length) body.type = types;
  const data = await call<{ workRecords?: WorkRecord[] }[]>("/device/workRecord/list", body, token);
  return (Array.isArray(data) ? data : [])
    .flatMap((day) => day.workRecords ?? [])
    .filter((r) => r && typeof r.type === "string" && r.recordTime);
}

// Which work-record types count as "the feeder fed". The Polar's exact type
// names aren't documented, so the default matches successful output/feed events;
// override with PETLIBRO_FEED_TYPES (comma-separated) once you've confirmed them
// via /api/petlibro/sync?debug=1.
export function isFeedRecord(type: string): boolean {
  const override = process.env.PETLIBRO_FEED_TYPES;
  if (override) {
    return override.split(",").map((s) => s.trim()).includes(type);
  }
  const t = type.toUpperCase();
  if (/FAIL|ERROR|BLOCK|CANCEL|SKIP|STOP|PLAN_|CHANGE|SETTING/.test(t)) return false;
  return /OUTPUT_SUCCESS|FEED/.test(t);
}

const SN_KEY = "petlibro";
const FIRST_SYNC_LOOKBACK_MS = 2 * 24 * 3600 * 1000;

export type PetLibroSyncResult = {
  ok: boolean;
  inserted: number;
  devices: string[];
  since?: string;
  error?: string;
  seenTypes?: Record<string, number>; // debug: every record type returned
  records?: WorkRecord[]; // debug: raw records
};

// Pull the wet feeder's activity log and log each feed as a "wet" feeding at the
// time it happened. A cursor (device_status row "petlibro", last_seen = newest
// synced feed) means a deleted auto-entry stays deleted; external_id is unique so
// overlapping runs (cron + button) can't double-insert.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function syncPetLibro(supabase: any, debug = false): Promise<PetLibroSyncResult> {
  const email = process.env.PETLIBRO_EMAIL;
  const password = process.env.PETLIBRO_PASSWORD;
  if (!email || !password) {
    return { ok: false, inserted: 0, devices: [], error: "PETLIBRO_EMAIL / PETLIBRO_PASSWORD not set" };
  }

  const { data: cursorRow } = await supabase
    .from("device_status")
    .select("last_seen")
    .eq("id", SN_KEY)
    .maybeSingle();
  const since = cursorRow
    ? new Date(cursorRow.last_seen)
    : new Date(Date.now() - FIRST_SYNC_LOOKBACK_MS);

  const token = await login(email, password);
  const all = await listDevices(token);
  // Only wet-food feeders (the Polar). PETLIBRO_DEVICE_SN pins a specific one.
  const pinned = process.env.PETLIBRO_DEVICE_SN;
  const devices = all.filter((d) =>
    pinned ? d.deviceSn === pinned : /wet|polar/i.test(`${d.productName} ${d.name}`)
  );

  const rows: { fed_at: string; meal_type: "wet"; source: string; external_id: string }[] = [];
  const seenTypes: Record<string, number> = {};
  const rawRecords: WorkRecord[] = [];
  let newest = since.getTime();

  for (const d of devices) {
    const recs = await workRecords(token, d.deviceSn, debug ? new Date(Date.now() - FIRST_SYNC_LOOKBACK_MS) : since);
    for (const r of recs) {
      seenTypes[r.type] = (seenTypes[r.type] ?? 0) + 1;
      if (debug) rawRecords.push(r);
      if (!isFeedRecord(r.type) || r.recordTime <= since.getTime()) continue;
      rows.push({
        fed_at: new Date(r.recordTime).toISOString(),
        meal_type: "wet",
        source: "petlibro",
        external_id: `petlibro:${d.deviceSn}:${r.recordTime}`,
      });
      newest = Math.max(newest, r.recordTime);
    }
  }

  const base = {
    devices: devices.map((d) => `${d.name || d.productName} (${d.deviceSn})`),
    since: since.toISOString(),
  };

  // Debug is read-only: show what the API returned without logging anything.
  if (debug) {
    return {
      ok: true,
      inserted: 0,
      ...base,
      seenTypes,
      records: rawRecords,
      error: devices.length ? undefined : `No wet feeder found among: ${all.map((d) => d.productName).join(", ") || "(none)"}`,
    };
  }

  if (rows.length) {
    const { error } = await supabase
      .from("feedings")
      .upsert(rows, { onConflict: "external_id", ignoreDuplicates: true });
    if (error) return { ok: false, inserted: 0, ...base, error: `DB insert failed: ${error.message}` };

    await supabase
      .from("device_status")
      .upsert({ id: SN_KEY, last_seen: new Date(newest).toISOString() }, { onConflict: "id" });
  } else if (!cursorRow) {
    // First run with nothing to log: start the cursor now so it doesn't re-scan.
    await supabase
      .from("device_status")
      .upsert({ id: SN_KEY, last_seen: new Date().toISOString() }, { onConflict: "id" });
  }

  return { ok: true, inserted: rows.length, ...base };
}
