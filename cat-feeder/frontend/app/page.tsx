import { supabase } from "@/lib/supabase";
import LastFed from "@/components/LastFed";
import FeedingSchedule from "@/components/FeedingSchedule";
import FeedingLog from "@/components/FeedingLog";
import WeightTracker from "@/components/WeightTracker";
import { learnSchedule } from "@/lib/schedule";

export const revalidate = 30; // revalidate every 30 seconds

async function getFeedings() {
  const { data, error } = await supabase
    .from("feedings")
    .select("*")
    .order("fed_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return data;
}

// More history (fed_at only) to learn the feeding schedule from.
async function getScheduleFeedings() {
  const { data, error } = await supabase
    .from("feedings")
    .select("id, fed_at, meal_type")
    .order("fed_at", { ascending: false })
    .limit(500);

  if (error) return [];
  return data;
}

async function getWeights() {
  const { data, error } = await supabase
    .from("weights")
    .select("*")
    .order("weighed_at", { ascending: false })
    .limit(200);

  // Table may not exist yet — degrade gracefully instead of crashing the page.
  if (error) return [];
  return data;
}

export default async function Home() {
  const [feedings, weights, scheduleFeedings] = await Promise.all([
    getFeedings(),
    getWeights(),
    getScheduleFeedings(),
  ]);
  const schedule = learnSchedule(scheduleFeedings);

  return (
    <main>
      <header>
        <h1>🐱 Cat Feeder</h1>
        <p className="subtitle">Umi &amp; Ebi · feeding + weight tracker</p>
      </header>
      <section className="panel">
        <LastFed feedings={feedings} />
        <FeedingSchedule schedule={schedule} feedings={feedings} />
      </section>
      <div className="dashboard-grid">
        <section className="panel">
          <WeightTracker weights={weights} />
        </section>
        <section className="panel">
          <FeedingLog feedings={feedings} />
        </section>
      </div>
    </main>
  );
}
