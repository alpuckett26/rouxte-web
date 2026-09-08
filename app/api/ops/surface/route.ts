import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createClient } from "@/lib/supabase/api";
import { isSuperAdminEmail } from "@/lib/auth/super-admin";
import surface from "@/surface.json";

/**
 * Only the fields this route touches. Declared rather than inferred: TypeScript
 * narrows an empty array in the generated JSON to `never[]`, so the route's
 * types would otherwise change shape with the content of the last build.
 */
type SurfaceManifest = Record<string, unknown> & { hosts: string[] };
const manifest = surface as SurfaceManifest;

/**
 * GET /api/ops/surface — Rouxte's SURFACE MANIFEST (rouxte-web#21).
 *
 * Every HTTP surface this app serves, enumerated from the Next.js App Router
 * tree by scripts/generate-surface.mjs and regenerated on every build
 * (`prebuild`). It is read off the router, so it cannot disagree with what is
 * served — that is the entire point. Nobody hand-maintains this list.
 *
 * Auth — any one of:
 *   Authorization: Bearer $CRON_SECRET        (ops / our own crons)
 *   X-Answers-Secret: $ANSWERS_BUILD_SECRET   (the spine already holds this —
 *                                              it is the push-rail secret)
 *   a signed-in super-admin session           (browser)
 *
 * Guarded rather than public on purpose: a complete route list with a `public`
 * flag on each entry is a map of exactly where to knock.
 */
export async function GET(request: NextRequest) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // The build knows its configured hosts; only the request knows the host it
  // actually arrived on. Report both, and say which is which — a seat
  // reasoning from one host would miss half the surface.
  const observed = request.headers.get("host");
  const hosts = [...manifest.hosts];
  if (observed && !hosts.includes(observed)) hosts.push(observed);

  return NextResponse.json(
    { ...manifest, hosts, host_observed: observed, served_at: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/** Length-safe, constant-time secret comparison. */
function secretMatches(presented: string | null, expected: string | undefined): boolean {
  if (!presented || !expected) return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function authorized(request: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && secretMatches(request.headers.get("authorization"), `Bearer ${cronSecret}`)) {
    return true;
  }

  if (secretMatches(request.headers.get("x-answers-secret"), process.env.ANSWERS_BUILD_SECRET)) {
    return true;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return isSuperAdminEmail(user?.email);
}
