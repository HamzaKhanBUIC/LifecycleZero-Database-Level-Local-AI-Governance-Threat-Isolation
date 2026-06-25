// Middleware: When Clerk is disabled (NEXT_PUBLIC_SKIP_CLERK=true), pass all requests through.
// When Clerk is active, enforce auth on /dashboard/* routes.
// NOTE: clerkMiddleware is loaded dynamically to prevent Clerk SDK from
// crashing at module-init time when no valid publishable key is configured.
import { NextResponse, type NextRequest } from "next/server";

const SKIP_CLERK = process.env.NEXT_PUBLIC_SKIP_CLERK === "true";

async function middleware(req: NextRequest) {
  if (SKIP_CLERK) {
    return NextResponse.next();
  }
  // Only load Clerk when a valid publishable key exists
  const pubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!pubKey || !pubKey.startsWith("pk_")) {
    return NextResponse.next();
  }
  const { clerkMiddleware, createRouteMatcher } = await import("@clerk/nextjs/server");
  const isDashboardRoute = createRouteMatcher(["/dashboard(.*)"]);
  return clerkMiddleware(async (auth, request) => {
    if (isDashboardRoute(request)) {
      await auth.protect();
    }
  })(req, {} as any);
}

export default middleware;

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
