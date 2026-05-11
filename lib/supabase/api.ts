import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";

/**
 * Universal /api/* Supabase client.
 *
 * Web requests:    reads the session from the Next.js cookie store (@supabase/ssr).
 * Mobile requests: reads the JWT from the `Authorization: Bearer <jwt>` header.
 *
 * The returned client exposes the same surface in both cases. In particular,
 * `supabase.auth.getUser()` (no arguments) works for Bearer requests too —
 * the helper monkey-patches the method to default to the bearer JWT, so
 * route handlers can call it the same way regardless of caller.
 *
 * RLS still enforces all org/role scoping in both paths because the JWT
 * (cookie or header) is propagated to PostgREST via the Authorization header.
 */
export async function createApiClient(): Promise<SupabaseClient> {
  const hdrs = await headers();
  const authHeader = hdrs.get("authorization") ?? hdrs.get("Authorization");

  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const jwt = authHeader.slice(7).trim();
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    );

    // Make supabase.auth.getUser() default to the bearer JWT so routes can
    // call `await supabase.auth.getUser()` exactly as the cookie path does.
    const originalGetUser = supabase.auth.getUser.bind(supabase.auth);
    supabase.auth.getUser = ((token?: string) =>
      originalGetUser(token ?? jwt)) as typeof supabase.auth.getUser;

    return supabase;
  }

  // Cookie path — same behavior as the previous lib/supabase/server.ts.
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — mutations no-op (middleware handles refresh).
          }
        },
      },
    }
  );
}

// Alias for migration ergonomics — routes can switch the import path without
// touching the call site (`const supabase = await createClient();`).
export const createClient = createApiClient;
