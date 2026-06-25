/**
 * Vercel Edge Middleware
 *
 * Responsibilities:
 *   1. Per-IP sliding-window rate limiting on /api/ingest
 *      — 20 requests per 10-second window per IP
 *      — Returns HTTP 429 with Retry-After header when exceeded
 *      — Protects against telemetry flood / DDoS on the ingestion endpoint
 *   2. Optional Clerk authentication enforcement on /dashboard/* routes
 *
 * Rate limiter notes:
 *   Edge Middleware runs in the Vercel Edge Runtime (V8 isolates) — not Node.js.
 *   We use an in-memory Map as a sliding-window store. In production this is
 *   acceptable because Vercel Edge colocates isolates per-region; for cross-region
 *   consistency, replace with an Upstash Redis adapter using the @upstash/ratelimit
 *   package (already listed in package.json devDependencies for that migration path).
 */
import { NextResponse, type NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Rate Limiter — Sliding Window (in-memory, per Edge isolate)
// ---------------------------------------------------------------------------
const RATE_LIMIT_WINDOW_MS = 10_000; // 10 seconds
const RATE_LIMIT_MAX_REQUESTS = 20;  // 20 requests per window per IP

interface RateEntry {
  timestamps: number[];
}

const ipStore = new Map<string, RateEntry>();

function isRateLimited(ip: string): { limited: boolean; retryAfterMs: number } {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  if (!ipStore.has(ip)) {
    ipStore.set(ip, { timestamps: [] });
  }

  const entry = ipStore.get(ip)!;
  // Evict timestamps outside the current window
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  if (entry.timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    // Earliest timestamp determines when the window resets for this IP
    const oldestTimestamp = entry.timestamps[0];
    const retryAfterMs = oldestTimestamp + RATE_LIMIT_WINDOW_MS - now;
    return { limited: true, retryAfterMs: Math.max(0, retryAfterMs) };
  }

  entry.timestamps.push(now);
  return { limited: false, retryAfterMs: 0 };
}

// ---------------------------------------------------------------------------
// Middleware entry point
// ---------------------------------------------------------------------------
const SKIP_CLERK = process.env.NEXT_PUBLIC_SKIP_CLERK === "true";

async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // --- Rate limiting: /api/ingest only ---
  if (pathname === "/api/ingest" && req.method === "POST") {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const { limited, retryAfterMs } = isRateLimited(ip);
    if (limited) {
      return NextResponse.json(
        {
          error: "RATE_LIMITED",
          message: `Too many telemetry events. Maximum ${RATE_LIMIT_MAX_REQUESTS} requests per ${RATE_LIMIT_WINDOW_MS / 1000}s window. Retry after ${Math.ceil(retryAfterMs / 1000)}s.`,
          retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(retryAfterMs / 1000)),
            "X-RateLimit-Limit": String(RATE_LIMIT_MAX_REQUESTS),
            "X-RateLimit-Window": `${RATE_LIMIT_WINDOW_MS / 1000}s`,
          },
        }
      );
    }
  }

  // --- Clerk authentication: /dashboard/* ---
  if (!SKIP_CLERK) {
    const pubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    if (pubKey && pubKey.startsWith("pk_")) {
      const { clerkMiddleware, createRouteMatcher } = await import("@clerk/nextjs/server");
      const isDashboardRoute = createRouteMatcher(["/dashboard(.*)"]);
      return clerkMiddleware(async (auth, request) => {
        if (isDashboardRoute(request)) {
          await auth.protect();
        }
      })(req, {} as any) as unknown as NextResponse;
    }
  }

  return NextResponse.next();
}

export default middleware;

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};

