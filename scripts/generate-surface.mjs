#!/usr/bin/env node
/**
 * Surface manifest generator — rouxte-web#21 (Anseur → all).
 *
 * Enumerates every HTTP surface this app serves by reading the Next.js App
 * Router tree, NOT by anyone remembering it. Runs on every build (`prebuild`),
 * so the published manifest cannot disagree with what is served.
 *
 *   node scripts/generate-surface.mjs [--tracked] [--check] [--out <path>]
 *
 *   --tracked  enumerate only git-tracked files (used for the committed
 *              snapshot, so untracked local work never appears as shipped).
 *              Default is the working tree, which is what a running app
 *              actually serves. On Vercel the two are identical.
 *   --check    exit 1 if the on-disk manifest differs (ignoring generated_at).
 *
 * Guard vocabulary is derived from patterns that exist in this repo. An
 * unrecognised guard reads as `[]` — i.e. PUBLIC — on purpose: the failure
 * mode of this tool must be "claims a guarded route is public" (noisy, gets
 * investigated), never the inverse (silent, ships a hole).
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname, resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APP = join(ROOT, "app");
const HTTP_METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];

const argv = process.argv.slice(2);
const TRACKED_ONLY = argv.includes("--tracked");
const CHECK = argv.includes("--check");
const OUT = argv.includes("--out")
  ? resolve(argv[argv.indexOf("--out") + 1])
  : join(ROOT, "surface.json");

/* ── source hygiene ─────────────────────────────────────────────────────── */

/** Strip comments so a guard named in prose is never mistaken for a guard in code. */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => (l.trim().startsWith("//") ? "" : l.replace(/(?<![:'"`])\/\/.*$/, "")))
    .join("\n");
}

/* ── file discovery ─────────────────────────────────────────────────────── */

let trackedSet = null;
function isTracked(abs) {
  if (!TRACKED_ONLY) return true;
  if (trackedSet === null) {
    try {
      const out = execFileSync("git", ["ls-files", "app"], { cwd: ROOT, encoding: "utf8" });
      trackedSet = new Set(out.split("\n").filter(Boolean).map((p) => join(ROOT, p)));
    } catch {
      trackedSet = new Set(); // no git → nothing provably tracked
    }
  }
  return trackedSet.has(abs);
}

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) {
      walk(abs, acc);
    } else if (/^(route|page)\.tsx?$/.test(name) && isTracked(abs)) {
      acc.push(abs);
    }
  }
  return acc;
}

/* ── path mapping ───────────────────────────────────────────────────────── */

/** app/api/leads/[id]/notes/route.ts → /api/leads/:id/notes */
function toRoutePath(abs) {
  const segs = relative(APP, dirname(abs)).split(sep).filter((s) => s && s !== ".");
  const out = [];
  for (const s of segs) {
    if (/^\(.*\)$/.test(s)) continue; // route group — not in the URL
    if (s.startsWith("@")) continue; // parallel route slot
    if (/^\[\[\.\.\..+\]\]$/.test(s)) out.push(`*${s.slice(5, -2)}?`);
    else if (/^\[\.\.\..+\]$/.test(s)) out.push(`*${s.slice(4, -1)}`);
    else if (/^\[.+\]$/.test(s)) out.push(`:${s.slice(1, -1)}`);
    else out.push(s);
  }
  return "/" + out.join("/");
}

/* ── middleware layer ───────────────────────────────────────────────────── */

/**
 * Read the public-path allowlist out of lib/supabase/middleware.ts rather than
 * restating it here. A restated list is a list that drifts.
 */
function readMiddlewarePublic() {
  const file = join(ROOT, "lib", "supabase", "middleware.ts");
  const src = stripComments(readFileSync(file, "utf8"));
  const m = src.match(/const\s+isPublicPath\s*=([\s\S]*?);\s*\n/);
  if (!m) throw new Error("could not locate isPublicPath in lib/supabase/middleware.ts");
  const block = m[1];
  return {
    prefixes: [...block.matchAll(/startsWith\(\s*"([^"]+)"/g)].map((x) => x[1]),
    exact: [...block.matchAll(/pathname\s*===\s*"([^"]+)"/g)].map((x) => x[1]),
    source: "lib/supabase/middleware.ts:isPublicPath",
  };
}

function middlewareAllowsAnonymous(path, mw) {
  return mw.exact.includes(path) || mw.prefixes.some((p) => path.startsWith(p));
}

/* ── guard classification ───────────────────────────────────────────────── */

const GUARD_PATTERNS = [
  [/auth\s*\.\s*getUser\s*\(/, "session"],
  [/requireSuperAdmin\s*\(/, "super-admin"],
  [/requireManager\s*\(/, "manager-role"],
  [/process\.env\.CRON_SECRET/, "cron-secret"],
  [/x-answers-secret/i, "shared-secret:X-Answers-Secret"],
  [/x-internal-secret/i, "shared-secret:X-Internal-Secret"],
  [/createHmac\s*\(|hmacsha256|verify\w*Signature\s*\(/i, "hmac-signature"],
];

function guardsIn(body) {
  const found = [];
  for (const [re, name] of GUARD_PATTERNS) {
    if (re.test(body) && !found.includes(name)) found.push(name);
  }
  return found;
}

/**
 * Split a route module into per-method bodies. A route file may guard GET and
 * leave POST open; a file-level scan would hide that.
 */
function methodBodies(src) {
  const re =
    /export\s+(?:async\s+)?(?:function|const)\s+(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)\b/g;
  const hits = [...src.matchAll(re)];
  const out = {};
  hits.forEach((h, i) => {
    const end = i + 1 < hits.length ? hits[i + 1].index : src.length;
    out[h[1]] = src.slice(h.index, end);
  });
  return out;
}

/** `export { GET } from "../note/route"` — an alias inherits the target's guards. */
function reExports(abs, src) {
  const out = [];
  for (const m of src.matchAll(/export\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)) {
    const methods = m[1]
      .split(",")
      .map((s) => s.trim().split(/\s+as\s+/).pop().trim())
      .filter((s) => HTTP_METHODS.includes(s));
    if (!methods.length) continue;
    for (const ext of [".ts", ".tsx", "/index.ts"]) {
      const target = resolve(dirname(abs), m[2] + ext);
      if (existsSync(target)) {
        out.push({ methods, target });
        break;
      }
    }
  }
  return out;
}

function classifyRoute(abs, depth = 0) {
  const src = stripComments(readFileSync(abs, "utf8"));
  const methods = {};
  for (const [name, body] of Object.entries(methodBodies(src))) {
    methods[name] = guardsIn(body);
  }
  if (depth < 3) {
    for (const { methods: names, target } of reExports(abs, src)) {
      const inherited = classifyRoute(target, depth + 1);
      for (const n of names) {
        methods[n] = inherited[n] ?? inherited.GET ?? [];
      }
    }
  }
  return methods;
}

/* ── hosts ──────────────────────────────────────────────────────────────── */

/**
 * Hosts are configuration, not folklore. Anything we cannot read is ABSENT,
 * not zero — the manifest names the env vars consulted so a reader can tell an
 * empty list from an unset one.
 */
function hosts() {
  const vars = [
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_SITE_URL",
    "VERCEL_PROJECT_PRODUCTION_URL",
    "VERCEL_URL",
  ];
  const seen = [];
  const unset = [];
  for (const v of vars) {
    const raw = process.env[v];
    if (!raw) {
      unset.push(v);
      continue;
    }
    let h = raw.trim();
    try {
      h = new URL(h.includes("://") ? h : `https://${h}`).host;
    } catch {
      /* not a URL — keep the raw value rather than invent one */
    }
    if (h && !seen.includes(h)) seen.push(h);
  }
  return { hosts: seen, hosts_consulted: vars, hosts_unset: unset };
}

function commit() {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA;
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

/* ── build ──────────────────────────────────────────────────────────────── */

export function buildManifest(now = new Date().toISOString()) {
  const mw = readMiddlewarePublic();
  const files = walk(APP).sort();
  const routes = [];

  for (const abs of files) {
    const path = toRoutePath(abs);
    const file = relative(ROOT, abs).split(sep).join("/");
    const anon = middlewareAllowsAnonymous(path, mw);
    const layer = anon ? [] : ["middleware:session-redirect"];

    if (/route\.tsx?$/.test(abs)) {
      const byMethod = classifyRoute(abs);
      for (const method of Object.keys(byMethod)) {
        routes.push({
          path,
          method,
          kind: "handler",
          guards: [...layer, ...byMethod[method]],
          public: layer.length === 0 && byMethod[method].length === 0,
          file,
        });
      }
    } else {
      routes.push({ path, method: "GET", kind: "page", guards: layer, public: layer.length === 0, file });
    }
  }

  routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

  // Grouped by first path segment, except /api — where a single `/api/` bucket
  // would collapse 130+ surfaces into one row and say nothing. See
  // segment_rule; this is the one deviation from the rouxte-web#21 shape.
  const segmentOf = (p) => {
    const s = p.split("/").filter(Boolean);
    if (!s.length) return "/";
    return s[0] === "api" && s.length > 1 ? `/api/${s[1]}/` : `/${s[0]}/`;
  };
  const bySeg = new Map();
  for (const r of routes) {
    const key = segmentOf(r.path);
    if (!bySeg.has(key)) bySeg.set(key, { segment: key, count: 0, public: 0, guards: [] });
    const e = bySeg.get(key);
    e.count += 1;
    if (r.public) e.public += 1;
    for (const g of r.guards) if (!e.guards.includes(g)) e.guards.push(g);
  }
  const segments = [...bySeg.values()].sort((a, b) => a.segment.localeCompare(b.segment));

  return {
    seat: "rouxte",
    repo: "alpuckett26/rouxte-web",
    ...hosts(),
    generated_at: now,
    commit: commit(),
    source: TRACKED_ONLY
      ? "next app router — app/ directory, git-tracked files only"
      : "next app router — app/ directory, working tree",
    generator: "scripts/generate-surface.mjs",
    middleware: {
      ...mw,
      note:
        "Next.js middleware redirects anonymous requests to /auth for any path " +
        "outside this allowlist. /api/* is allowlisted wholesale, so every API " +
        "route's real guard is the one inside its own handler.",
    },
    segment_rule: "first path segment; /api/* grouped at depth 2",
    counts: {
      routes: routes.length,
      handlers: routes.filter((r) => r.kind === "handler").length,
      pages: routes.filter((r) => r.kind === "page").length,
      public: routes.filter((r) => r.public).length,
    },
    segments,
    routes,
  };
}

/* ── cli ────────────────────────────────────────────────────────────────── */

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const manifest = buildManifest();
  const json = JSON.stringify(manifest, null, 2) + "\n";

  if (CHECK) {
    if (!existsSync(OUT)) {
      console.error(`surface: ${OUT} missing — run \`npm run surface\``);
      process.exit(1);
    }
    // --check asks "has the SURFACE drifted", so it ignores the fields that
    // vary with when/where the generator ran rather than with what is served.
    const VOLATILE = ["generated_at", "commit", "hosts", "hosts_unset", "source"];
    const strip = (o) => {
      const copy = { ...o };
      for (const k of VOLATILE) delete copy[k];
      return JSON.stringify(copy);
    };
    if (strip(JSON.parse(readFileSync(OUT, "utf8"))) !== strip(manifest)) {
      console.error("surface: manifest is stale — run `npm run surface`");
      process.exit(1);
    }
    console.log(`surface: up to date (${manifest.counts.routes} routes)`);
  } else {
    writeFileSync(OUT, json);
    console.log(
      `surface: ${manifest.counts.routes} routes → ${relative(ROOT, OUT)} ` +
        `(${manifest.counts.public} unguarded)`
    );
  }
}
