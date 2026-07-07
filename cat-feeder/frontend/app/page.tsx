import { supabase } from "@/lib/supabase";
import LastFed from "@/components/LastFed";
import FeedingLog from "@/components/FeedingLog";

export const revalidate = 30; // revalidate every 30 seconds

async function getFeedings() {
  const { data, error } = await supabase
    .from("feedings")
    .select("*")
    .order("fed_at", { ascending: false })
    .limit(20);

  if (error) throw error;
  return data;
}

export default async function Home() {
  const feedings = await getFeedings();

  return (
    <main>
      <header>
        <h1>🐱 Cat Feeder</h1>
        <p className="subtitle">Track when your cats were fed</p>
      </header>
      <LastFed feedings={feedings} />
      <FeedingLog feedings={feedings} />
    </main>
  );
}
