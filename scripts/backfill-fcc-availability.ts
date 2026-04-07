/**
 * Backfills FCC AT&T availability for all leads with lat/lng.
 * Runs in batches of 50 to avoid timeouts.
 *
 * Usage:
 *   npx dotenv -e .env.local -- npx tsx scripts/backfill-fcc-availability.ts
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const BATCH = 50;

async function main() {
  // Fetch all leads with coordinates
  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, lat, lng")
    .not("lat", "is", null)
    .not("lng", "is", null);

  if (error) { console.error("Fetch error:", error.message); process.exit(1); }
  if (!leads?.length) { console.log("No leads with coordinates found."); return; }

  console.log(`Checking FCC availability for ${leads.length} leads…\n`);

  let updated = 0;
  let available = 0;

  for (let i = 0; i < leads.length; i += BATCH) {
    const batch = leads.slice(i, i + BATCH);

    // Check each lead in the batch
    const updates = await Promise.all(
      batch.map(async (lead) => {
        const { data } = await supabase.rpc("fcc_att_available", {
          p_lat: lead.lat,
          p_lng: lead.lng,
        });
        return { id: lead.id, att: !!data };
      })
    );

    // Group by availability for efficient updates
    const attTrue  = updates.filter((u) => u.att).map((u) => u.id);
    const attFalse = updates.filter((u) => !u.att).map((u) => u.id);

    if (attTrue.length) {
      await supabase
        .from("leads")
        .update({ carrier_availability: { att: true } })
        .in("id", attTrue);
      available += attTrue.length;
    }
    if (attFalse.length) {
      await supabase
        .from("leads")
        .update({ carrier_availability: { att: false } })
        .in("id", attFalse);
    }

    updated += batch.length;
    process.stdout.write(`\r  ${updated}/${leads.length} checked, ${available} with AT&T fiber…`);
  }

  console.log(`\n\nDone. ${available}/${leads.length} leads have AT&T fiber available.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
