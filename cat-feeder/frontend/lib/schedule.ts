import { Feeding } from "./supabase";

// Everything is modeled in the cats' local timezone.
export const TZ = "America/New_York";

export type Slot = {
  center: number; // hour-of-day 0..24 (local)
  std: number; // spread in hours
  count: number; // how many feedings landed in this slot
};

export type Schedule = {
  slots: Slot[];
  medianPerDay: number;
  numDays: number;
  quietStart: number; // start of the overnight lull (local hour)
  quietEnd: number; // end of the lull
};

function localParts(date: Date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const p: Record<string, string> = {};
  fmt.formatToParts(date).forEach((x) => (p[x.type] = x.value));
  const y = Number(p.year);
  const mo = Number(p.month);
  const d = Number(p.day);
  return {
    key: `${p.year}-${p.month}-${p.day}`,
    y,
    mo,
    d,
    hour: (Number(p.hour) % 24) + Number(p.minute) / 60,
  };
}

// A continuous "wall-clock hours" timeline in TZ: dayNumber*24 + hour-of-day.
// Lets us compare feedings/slots/now without absolute-instant timezone math,
// so the logic is identical on the browser and the (UTC) server. (A DST switch
// nudges this by ±1h twice a year — negligible for a cat feeder.)
function tzDayNum(p: { y: number; mo: number; d: number }): number {
  return Math.round(Date.UTC(p.y, p.mo - 1, p.d) / 86400000);
}
function tzHours(date: Date): number {
  const p = localParts(date);
  return tzDayNum(p) * 24 + p.hour;
}

// 1D k-means: returns cluster centers and per-point assignments.
function kmeans1d(data: number[], K: number) {
  const n = data.length;
  K = Math.min(K, n);
  const sorted = [...data].sort((a, b) => a - b);
  let centers = Array.from({ length: K }, (_, i) => sorted[Math.floor(((i + 0.5) / K) * n)]);
  const assign = new Array(n).fill(0);

  for (let iter = 0; iter < 60; iter++) {
    let changed = false;
    for (let i = 0; i < n; i++) {
      let best = 0;
      let bd = Infinity;
      for (let k = 0; k < K; k++) {
        const dd = Math.abs(data[i] - centers[k]);
        if (dd < bd) {
          bd = dd;
          best = k;
        }
      }
      if (assign[i] !== best) {
        assign[i] = best;
        changed = true;
      }
    }
    const sum = new Array(K).fill(0);
    const cnt = new Array(K).fill(0);
    for (let i = 0; i < n; i++) {
      sum[assign[i]] += data[i];
      cnt[assign[i]]++;
    }
    for (let k = 0; k < K; k++) if (cnt[k]) centers[k] = sum[k] / cnt[k];
    if (!changed) break;
  }
  return { centers, assign };
}

// Learn feeding slots from history via clustering on time-of-day.
export function learnSchedule(feedings: Feeding[]): Schedule {
  const times = feedings.map((f) => localParts(new Date(f.fed_at)).hour);

  const byDay = new Map<string, number>();
  feedings.forEach((f) => {
    const k = localParts(new Date(f.fed_at)).key;
    byDay.set(k, (byDay.get(k) || 0) + 1);
  });
  const counts = Array.from(byDay.values()).sort((a, b) => a - b);
  const numDays = counts.length || 1;
  const medianPerDay = counts.length ? counts[Math.floor(counts.length / 2)] : 4;

  if (times.length < 6) {
    return { slots: [], medianPerDay, numDays, quietStart: 4, quietEnd: 8 };
  }

  // Largest gap on the 24h circle = the overnight lull. Rotate the axis to its
  // middle so no real cluster straddles the midnight wrap.
  const s = [...times].sort((a, b) => a - b);
  let bestGap = -1;
  let cut = 4;
  let quietStart = 4;
  let quietEnd = 8;
  for (let i = 0; i < s.length; i++) {
    const a = s[i];
    const b = i + 1 < s.length ? s[i + 1] : s[0] + 24;
    if (b - a > bestGap) {
      bestGap = b - a;
      cut = ((a + b) / 2) % 24;
      quietStart = a % 24;
      quietEnd = b % 24;
    }
  }

  const rot = times.map((t) => (((t - cut) % 24) + 24) % 24);
  const K = Math.max(2, Math.min(6, medianPerDay));
  const { centers, assign } = kmeans1d(rot, K);

  const slots: Slot[] = centers
    .map((_, i) => {
      const members = rot.filter((_, idx) => assign[idx] === i);
      if (!members.length) return null;
      const mean = members.reduce((a, b) => a + b, 0) / members.length;
      const variance = members.reduce((a, b) => a + (b - mean) ** 2, 0) / members.length;
      return {
        center: (((mean + cut) % 24) + 24) % 24,
        std: Math.sqrt(variance),
        count: members.length,
      };
    })
    .filter((x): x is Slot => x !== null)
    .sort((a, b) => a.center - b.center);

  return { slots, medianPerDay, numDays, quietStart, quietEnd };
}

// 10.63 -> "10:38a"
export function fmtHour(h: number): string {
  h = ((h % 24) + 24) % 24;
  let H = Math.floor(h);
  let M = Math.round((h - H) * 60);
  if (M === 60) {
    H = (H + 1) % 24;
    M = 0;
  }
  const ap = H < 12 ? "a" : "p";
  const h12 = H % 12 === 0 ? 12 : H % 12;
  return `${h12}:${String(M).padStart(2, "0")}${ap}`;
}

export function fmtDur(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export type Prediction = {
  status: "upcoming" | "overdue" | "quiet" | "unknown";
  nextHour: number | null; // hour-of-day (0..24) of the next expected slot
  dueHour: number | null; // hour-of-day of the slot we're overdue on
  minutes: number; // minutes until nextHour, or minutes overdue
  lastFedHour: number | null; // hour-of-day of the most recent feeding
  slotKey: string | null; // stable id of the due/overdue slot (for alert de-dupe)
};

const COVER_H = 1.25; // a feeding within 75m of a slot "covers" it
const GRACE_H = 1.0; // only overdue once 60m past the slot

function isQuiet(hour: number, start: number, end: number): boolean {
  return start <= end ? hour >= start && hour <= end : hour >= start || hour <= end;
}

// Given the learned schedule + recent feedings + now, decide what's next / overdue.
// All comparisons happen on the TZ "wall-clock hours" timeline, so this is correct
// whether it runs in the browser or on a UTC server (the cron).
export function predictNext(schedule: Schedule, feedings: Feeding[], now: Date): Prediction {
  const feedVals = feedings.map((f) => tzHours(new Date(f.fed_at)));
  const lastFedVal = feedVals.length ? Math.max(...feedVals) : null;
  const lastFedHour = lastFedVal !== null ? (((lastFedVal % 24) + 24) % 24) : null;

  const none: Prediction = {
    status: "unknown",
    nextHour: null,
    dueHour: null,
    minutes: 0,
    lastFedHour,
    slotKey: null,
  };
  if (!schedule.slots.length) return none;

  const nowParts = localParts(now);
  const nowDay = tzDayNum(nowParts);
  const nowVal = nowDay * 24 + nowParts.hour;

  // Slot occurrences across yesterday/today/tomorrow on the same timeline.
  const instances = [];
  for (const off of [-1, 0, 1]) {
    for (const slot of schedule.slots) {
      instances.push({
        val: (nowDay + off) * 24 + slot.center,
        hour: slot.center,
        std: slot.std,
        day: nowDay + off,
      });
    }
  }
  instances.sort((a, b) => a.val - b.val);

  const covered = (inst: { val: number; std: number }) => {
    const win = Math.max(COVER_H, inst.std * 1.5);
    return feedVals.some((v) => Math.abs(v - inst.val) <= win);
  };
  const keyOf = (inst: { day: number; hour: number }) =>
    `${inst.day}@${Math.round(inst.hour * 60)}`;

  const quietNow = isQuiet(nowParts.hour, schedule.quietStart, schedule.quietEnd);
  const prev = [...instances].reverse().find((i) => i.val <= nowVal) || null;
  const next = instances.find((i) => i.val > nowVal) || null;

  // Overnight lull — never nag or look backward; point to the next morning slot.
  if (quietNow) {
    return {
      status: "quiet",
      nextHour: next ? next.hour : null,
      dueHour: null,
      minutes: next ? Math.round((next.val - nowVal) * 60) : 0,
      lastFedHour,
      slotKey: null,
    };
  }

  // Most-recent slot not yet covered → it's the pending one.
  if (prev && !covered(prev)) {
    if ((nowVal - prev.val) > GRACE_H) {
      return {
        status: "overdue",
        nextHour: next ? next.hour : null,
        dueHour: prev.hour,
        minutes: Math.round((nowVal - prev.val) * 60),
        lastFedHour,
        slotKey: keyOf(prev),
      };
    }
    return {
      status: "upcoming",
      nextHour: prev.hour,
      dueHour: null,
      minutes: Math.round((prev.val - nowVal) * 60),
      lastFedHour,
      slotKey: null,
    };
  }

  if (!next) return none;

  return {
    status: "upcoming",
    nextHour: next.hour,
    dueHour: null,
    minutes: Math.round((next.val - nowVal) * 60),
    lastFedHour,
    slotKey: null,
  };
}
