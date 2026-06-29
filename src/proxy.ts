import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Rate limiting configurations
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // 30 requests per minute

// Simple in-memory rate limit store for local fallback
const localStore = new Map<string, { timestamps: number[] }>();

async function isRateLimited(ip: string): Promise<{ limited: boolean; retryAfterMs: number }> {
  const now = Date.now();
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  // Use Upstash Redis REST API if configured
  if (redisUrl && redisToken) {
    try {
      const cleanedUrl = redisUrl.replace(/\/$/, "");
      const key = `rate_limit:ingest:${ip}`;
      
      const res = await fetch(`${cleanedUrl}/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${redisToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          ["INCR", key],
          ["PTTL", key],
        ]),
      });

      if (res.ok) {
        const [[, count], [, pttl]] = await res.json();
        
        // On first increment, set a 60-second expiration time
        if (count === 1) {
          await fetch(`${cleanedUrl}/EXPIRE/${key}/60`, {
            method: "GET",
            headers: { Authorization: `Bearer ${redisToken}` },
          });
        }

        if (count > RATE_LIMIT_MAX_REQUESTS) {
          return { limited: true, retryAfterMs: pttl > 0 ? pttl : 1000 };
        }
        return { limited: false, retryAfterMs: 0 };
      }
    } catch (err) {
      console.error("[MIDDLEWARE ERROR] Upstash Redis rate limit exception. Falling back to local store:", err);
    }
  }

  // Local fallback (in-memory)
  if (!localStore.has(ip)) {
    localStore.set(ip, { timestamps: [] });
  }

  const entry = localStore.get(ip)!;
  entry.timestamps = entry.timestamps.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);

  if (entry.timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    const oldest = entry.timestamps[0];
    const retryAfterMs = RATE_LIMIT_WINDOW_MS - (now - oldest);
    return { limited: true, retryAfterMs };
  }

  entry.timestamps.push(now);
  return { limited: false, retryAfterMs: 0 };
}

// Clerk route matcher
const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/security(.*)"]);

export default clerkMiddleware(async (auth, req) => {
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
          message: `Too many telemetry events. Maximum ${RATE_LIMIT_MAX_REQUESTS} requests per ${RATE_LIMIT_WINDOW_MS / 1000}s. Retry after ${Math.ceil(retryAfterMs / 1000)}s.`,
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

  // --- Clerk protection: /dashboard/* & /security ---
  if (isProtectedRoute(req)) {
    const skipClerk = process.env.NEXT_PUBLIC_SKIP_CLERK === "true";
    const tenantCookie = req.cookies.get("lifecycle_tenant_id")?.value;
    const isDemoQuery = req.nextUrl.searchParams.get("demo") === "true";
    const allowedSandboxTenants = ["org_demo_123", "org_fintech_456", "org_healthco_789"];
    const isSandbox = isDemoQuery || allowedSandboxTenants.includes(tenantCookie || "");

    if (!skipClerk && !isSandbox) {
      const pubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
      if (pubKey && pubKey.startsWith("pk_")) {
        await auth.protect();
      }
    }
  }

  // Sniff demo query parameter and set cookie to org_demo_123 automatically so SSR has immediate context
  const isDemoQuery = req.nextUrl.searchParams.get("demo") === "true";
  const tenantCookie = req.cookies.get("lifecycle_tenant_id")?.value;
  if (isDemoQuery && tenantCookie !== "org_demo_123") {
    const response = NextResponse.next();
    response.cookies.set("lifecycle_tenant_id", "org_demo_123", { path: "/" });
    return response;
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
