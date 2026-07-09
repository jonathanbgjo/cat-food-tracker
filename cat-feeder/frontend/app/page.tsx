import { supabase } from "@/lib/supabase";
import LastFed from "@/components/LastFed";
import Stats from "@/components/Stats";
import FeedingLog from "@/components/FeedingLog";
import WeightTracker from "@/components/WeightTracker";

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
  const [feedings, weights] = await Promise.all([getFeedings(), getWeights()]);

  return (
    <main>
      <header>
        <h1>🐱 Cat Feeder</h1>
        <p className="subtitle">Umi &amp; Ebi · feeding + weight tracker</p>
      </header>
      <Stats feedings={feedings} />
      <LastFed feedings={feedings} />
      <WeightTracker weights={weights} />
      <FeedingLog feedings={feedings} />
    </main>
  );
}
