import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Self-service account deletion (App Store 5.1.1(v) + Google Play Data Deletion).
 *
 * Rouxte is a B2B workforce app: accounts are provisioned under a dealer org,
 * `sales_activity_log` is append-only (a DB trigger blocks DELETE), and
 * commission/tax records carry a legal retention obligation. So this is a
 * "request-based + anonymize" deletion, not a hard row delete:
 *
 *   1. Strip personal identifiers from the profile in place (name, avatar, phone).
 *   2. Revoke login: ban the auth user and scramble the auth email.
 *
 * De-identified financial/compliance rows remain per the privacy-policy retention
 * schedule. The caller (web or mobile) signs out locally after a 200.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const now = new Date().toISOString();

  // 1. Anonymize the profile in place — do NOT delete the row (FKs from the
  //    append-only activity log + retained financial records reference it).
  const { error: profileErr } = await admin
    .from("user_profiles")
    .update({
      full_name: "Deleted user",
      avatar_url: null,
      phone: null,
      deleted_at: now,
      deletion_requested_at: now,
      updated_at: now,
    })
    .eq("user_id", user.id);

  if (profileErr) {
    return NextResponse.json({ error: profileErr.message }, { status: 500 });
  }

  // 2. Revoke login and scrub the auth identity. The ban blocks token refresh
  //    and new sign-ins; scrambling the email removes the last personal
  //    identifier and frees it for future re-registration. Existing access
  //    tokens expire on their own (they cannot be refreshed once banned).
  const { error: authErr } = await admin.auth.admin.updateUserById(user.id, {
    email: `deleted+${user.id}@deleted.rouxte.com`,
    ban_duration: "876000h", // ~100 years
    user_metadata: {},
  });

  if (authErr) {
    return NextResponse.json({ error: authErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
