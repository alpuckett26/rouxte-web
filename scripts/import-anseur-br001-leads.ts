/**
 * Loads the 10 live Anseur pipeline leads (Baton Rouge hit list LEADS-BR-001,
 * the 10 on the Answers board) into Rouxte, assigned to the org admin (Aaron),
 * pre-geocoded so they land on the map immediately.
 *
 * Usage: npx dotenv -e .env.local -- npx tsx scripts/import-anseur-br001-leads.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SEED_ORG_ID.
 *
 * Leads are created with source='answers' and NO external_ref — the
 * answers-sync cron adopts them by address match on its first run and stamps
 * external_ref = Answers restaurant_id (the IDs live in the Answers DB).
 * Coordinates were geocoded 2026-07-14 via the US Census geocoder.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ORG_ID           = process.env.SEED_ORG_ID!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ORG_ID) {
  console.error("Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SEED_ORG_ID");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Top 10 of LEADS-BR-001 = the 10 on the Answers board
// (wave-1 six + Mr PO-Boy, Jazz Daddy's, Linda's, Wings N Things)
const LEADS = [
  { customer_name: "Dominique's Stockyard Cafe",   address: "1462 Airline Hwy, Baton Rouge, LA 70805",      phone: "(225) 357-6511", lat: 30.508253, lng: -91.175825 },
  { customer_name: "Pappa's Soul Food",            address: "8386 Airline Hwy, Baton Rouge, LA 70815",      phone: "(225) 201-1048", lat: 30.459115, lng: -91.100482 },
  { customer_name: "Dorothy's Soul Food Kitchen",  address: "1221 Gardere Ln Ste M, Baton Rouge, LA 70820", phone: "(225) 757-1146", lat: 30.358855, lng: -91.124768 },
  { customer_name: "Lillie's Kitchen",             address: "5735 Silverleaf Ave, Baton Rouge, LA 70812",   phone: "(225) 359-9555", lat: 30.502830, lng: -91.125369 },
  { customer_name: "Ethel's Snack Shack",          address: "1553 Fairchild St, Baton Rouge, LA 70807",     phone: "(225) 465-4512", lat: 30.522252, lng: -91.177368 },
  { customer_name: "Mr PO-Boy",                    address: "6888 Airline Hwy, Baton Rouge, LA 70805",      phone: "(225) 354-0220", lat: 30.488602, lng: -91.121547 },
  { customer_name: "N & Out Soul Food and Catering", address: "9836 Florida Blvd, Baton Rouge, LA 70815",   phone: "(225) 231-2362", lat: 30.455667, lng: -91.076357 },
  { customer_name: "Linda's Chicken & Fish",       address: "34790 Hwy 16 N, Denham Springs, LA 70706",     phone: "(225) 665-8604", lat: 30.567820, lng: -90.955566 },
  { customer_name: "Jazz Daddy's Poboys",          address: "17221 Jefferson Hwy, Baton Rouge, LA 70817",   phone: "(225) 751-2215", lat: 30.362173, lng: -91.003004 },
  { customer_name: "Wings N Things",               address: "990 W Lee Dr Ste D, Baton Rouge, LA 70820",    phone: "(225) 442-1244", lat: 30.389334, lng: -91.168944 },
];

async function main() {
  const { data: admin, error: adminErr } = await supabase
    .from("user_profiles")
    .select("user_id, full_name")
    .eq("org_id", ORG_ID)
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();

  if (adminErr || !admin) {
    console.error("No admin profile found for org", ORG_ID, adminErr?.message ?? "");
    process.exit(1);
  }

  const now = new Date().toISOString();
  const rows = LEADS.map((l) => ({
    org_id: ORG_ID,
    created_by: admin.user_id,
    assigned_to: admin.user_id,
    assigned_at: now,
    address: l.address,
    customer_name: l.customer_name,
    phone: l.phone,
    lat: l.lat,
    lng: l.lng,
    carrier_availability: {},
    status: "new",
    source: "answers",
  }));

  const { data, error } = await supabase
    .from("leads")
    .upsert(rows, { onConflict: "org_id,address", ignoreDuplicates: true })
    .select("id, customer_name, lat, lng");

  if (error) {
    console.error("Import failed:", error.message);
    process.exit(1);
  }

  console.log(`Imported ${data?.length ?? 0}/${LEADS.length} leads (skipped rows already existed), assigned to ${admin.full_name}:`);
  for (const row of data ?? []) {
    console.log(`  ✓ ${row.customer_name} @ ${row.lat},${row.lng}`);
  }
}

main();
