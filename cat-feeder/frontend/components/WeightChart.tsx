"use client";

import { CATS, CatName, Weight } from "@/lib/supabase";

const G_PER_LB = 453.59237;

// Entity colors — validated for CVD safety on the dark surface (see dataviz).
export const CAT_COLORS: Record<CatName, string> = {
  umi: "#9d5fd0",
  ebi: "#c47f28",
};

type Pt = { t: number; lb: number; day: string };

const W = 320;
const H = 168;
const PAD = { l: 30, r: 54, t: 16, b: 26 };

function fmtDate(day: string): string {
  const d = new Date(day + "T12:00:00Z");
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

export default function WeightChart({ weights }: { weights: Weight[] }) {
  const series = CATS.map((c) => ({
    cat: c.id,
    label: c.label,
    color: CAT_COLORS[c.id],
    pts: weights
      .filter((w) => w.cat === c.id)
      .map((w) => ({ t: Date.parse(w.day), lb: w.grams / G_PER_LB, day: w.day }))
      .sort((a, b) => a.t - b.t) as Pt[],
  })).filter((s) => s.pts.length > 0);

  const all = series.flatMap((s) => s.pts);
  if (all.length === 0) {
    return (
      <div className="chart-empty">
        No weight data yet — sync from the Litter-Robot.
      </div>
    );
  }

  let minT = Math.min(...all.map((p) => p.t));
  let maxT = Math.max(...all.map((p) => p.t));
  let minL = Math.min(...all.map((p) => p.lb));
  let maxL = Math.max(...all.map((p) => p.lb));

  const padY = Math.max(0.3, (maxL - minL) * 0.25);
  minL -= padY;
  maxL += padY;
  if (minT === maxT) {
    minT -= 86400000;
    maxT += 86400000;
  }

  const x = (t: number) =>
    PAD.l + (maxT === minT ? 0.5 : (t - minT) / (maxT - minT)) * (W - PAD.l - PAD.r);
  const y = (lb: number) =>
    PAD.t + (1 - (lb - minL) / (maxL - minL)) * (H - PAD.t - PAD.b);

  const ticks = [minL, (minL + maxL) / 2, maxL];

  return (
    <figure className="weight-chart">
      <figcaption className="chart-legend">
        {series.map((s) => (
          <span key={s.cat} className="legend-item">
            <span className="legend-dot" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </figcaption>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Cat weight over time">
        {/* gridlines + y labels */}
        {ticks.map((lb, i) => (
          <g key={i}>
            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={y(lb)}
              y2={y(lb)}
              stroke="#262626"
              strokeWidth={1}
            />
            <text x={PAD.l - 6} y={y(lb) + 3} textAnchor="end" className="chart-axis">
              {lb.toFixed(1)}
            </text>
          </g>
        ))}

        {/* x labels: first + last date */}
        <text x={x(minT)} y={H - 8} textAnchor="start" className="chart-axis">
          {fmtDate(all.reduce((a, b) => (a.t < b.t ? a : b)).day)}
        </text>
        <text x={W - PAD.r} y={H - 8} textAnchor="end" className="chart-axis">
          {fmtDate(all.reduce((a, b) => (a.t > b.t ? a : b)).day)}
        </text>

        {/* series */}
        {series.map((s) => {
          const path = s.pts
            .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.t).toFixed(1)},${y(p.lb).toFixed(1)}`)
            .join(" ");
          const last = s.pts[s.pts.length - 1];
          return (
            <g key={s.cat}>
              {s.pts.length > 1 && (
                <path d={path} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              )}
              {s.pts.map((p, i) => (
                <circle key={i} cx={x(p.t)} cy={y(p.lb)} r={4} fill={s.color} stroke="#141414" strokeWidth={1.5}>
                  <title>{`${s.label}: ${p.lb.toFixed(1)} lb · ${p.day}`}</title>
                </circle>
              ))}
              {/* direct end-label: neutral ink, colored marker carries identity */}
              <text x={x(last.t) + 8} y={y(last.lb) + 3} className="chart-endlabel">
                {last.lb.toFixed(1)}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
