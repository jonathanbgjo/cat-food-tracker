"use client";

import { useEffect, useState } from "react";
import { Feeding } from "@/lib/supabase";
import { Schedule, predictNext, fmtHour, fmtDur } from "@/lib/schedule";

type Props = {
  schedule: Schedule;
  feedings: Feeding[];
};

export default function FeedingSchedule({ schedule, feedings }: Props) {
  const [now, setNow] = useState<Date | null>(null);

  // Render nothing until mounted, then tick every minute (avoids hydration mismatch).
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  if (!schedule.slots.length) {
    return (
      <div className="schedule">
        <span className="sched-label">Learning the feeding schedule…</span>
      </div>
    );
  }

  const pred = now ? predictNext(schedule, feedings, now) : null;

  return (
    <div className="schedule">
      <div className="sched-times">
        <span className="sched-label">Usual times</span>
        {schedule.slots.map((s, i) => (
          <span key={i} className="sched-chip" title={`±${Math.round(s.std * 60)}m · seen ${s.count}×`}>
            {fmtHour(s.center)}
          </span>
        ))}
      </div>

      {pred && pred.status === "overdue" && pred.dueHour !== null && (
        <div className="sched-banner overdue">
          <span className="sched-icon">⚠</span>
          <span>
            <strong>Overdue by {fmtDur(pred.minutes)}</strong> — usually fed by ~
            {fmtHour(pred.dueHour)}
            {pred.lastFedHour !== null && (
              <span className="sched-sub"> · last fed {fmtHour(pred.lastFedHour)}</span>
            )}
          </span>
        </div>
      )}

      {pred && pred.status === "upcoming" && pred.nextHour !== null && (
        <div className="sched-banner upcoming">
          <span className="sched-icon">🍽️</span>
          <span>
            Next feeding usually ~<strong>{fmtHour(pred.nextHour)}</strong>
            <span className="sched-sub">
              {pred.minutes > 0 ? ` · in ${fmtDur(pred.minutes)}` : " · due now"}
            </span>
          </span>
        </div>
      )}

      {pred && pred.status === "quiet" && pred.nextHour !== null && (
        <div className="sched-banner quiet">
          <span className="sched-icon">😴</span>
          <span>
            Overnight lull — next feeding ~<strong>{fmtHour(pred.nextHour)}</strong>
          </span>
        </div>
      )}
    </div>
  );
}
