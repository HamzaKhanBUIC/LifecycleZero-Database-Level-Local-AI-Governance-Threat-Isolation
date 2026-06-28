/**
 * Next.js Edge Middleware
 *
 * Responsibilities:
 *   1. Per-IP sliding-window rate limiting on /api/ingest
 *      — 20 requests per 10-second window per IP
 *      — Returns HTTP 429 with Retry-After header when exceeded
 *      — Protects against telemetry flood / DDoS on the ingestion endpoint
 *   2. Optional Clerk authentication enforcement on /dashboard/* routes
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

async function isRateLimited(ip: string): Promise<{ limited: boolean; retryAfterMs: number }> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  const now = Date.now();
  const windowBucket = Math.floor(now / 10000); // 10-second fixed window
  const key = `ratelimit:${ip}:${windowBucket}`;

  if (redisUrl && redisToken) {
    try {
      // Zero-dependency REST pipeline call to Upstash Redis (Edge runtime compatible)
      const res = await fetch(`${redisUrl.replace(/\/$/, "")}/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${redisToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify([
          ["INCR", key],
          ["EXPIRE", key, 10]
        ]),
        // Prevent Vercel middleware from caching the rate-limit check response
        cache: "no-store"
      });

      if (res.ok) {
        const pipelineRes = await res.json();
        const count = Number(pipelineRes[0]?.result || 1);
        if (count > RATE_LIMIT_MAX_REQUESTS) {
          const retryAfterMs = (windowBucket + 1) * 10000 - now;
          return { limited: true, retryAfterMs: Math.max(0, retryAfterMs) };
        }
        return { limited: false, retryAfterMs: 0 };
      } else {
        console.warn("[MIDDLEWARE WARNING] Upstash Redis REST pipeline failed. Status:", res.status);
      }
    } catch (err) {
      console.error("[MIDDLEWARE ERROR] Upstash Redis rate limit exception. Falling back to local store:", err);
    }
  }

  // Local sliding window fallback (isolated per edge instance)
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  if (!ipStore.has(ip)) {
    ipStore.set(ip, { timestamps: [] });
  }

  const entry = ipStore.get(ip)!;
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  if (entry.timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
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

    const { limited, retryAfterMs } = await isRateLimited(ip);
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

  // --- Clerk authentication: /dashboard/* & /security ---
  const tenantCookie = req.cookies.get("lifecycle_tenant_id")?.value;
  const isDemoQuery = req.nextUrl.searchParams.get("demo") === "true";
  const allowedSandboxTenants = ["org_demo_123", "org_fintech_456", "org_healthco_789"];
  const isSandbox = isDemoQuery || allowedSandboxTenants.includes(tenantCookie || "");

  const isPublicApi = pathname.startsWith("/api/ingest") || pathname.startsWith("/api/webhooks");
  const shouldSkipClerk = SKIP_CLERK || isSandbox || isPublicApi;

  if (!shouldSkipClerk) {
    const pubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    if (pubKey && pubKey.startsWith("pk_")) {
      const { clerkMiddleware, createRouteMatcher } = await import("@clerk/nextjs/server");
      const isDashboardRoute = createRouteMatcher(["/dashboard(.*)", "/security(.*)"]);
      return clerkMiddleware(async (auth, request) => {
        if (isDashboardRoute(request)) {
          await auth.protect();
        }
      })(req, {} as any) as unknown as NextResponse;
    }
  }

  // Sniff demo query parameter and set cookie to org_demo_123 automatically so SSR has immediate context
  if (isDemoQuery && tenantCookie !== "org_demo_123") {
    const response = NextResponse.next();
    response.cookies.set("lifecycle_tenant_id", "org_demo_123", { path: "/" });
    return response;
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
