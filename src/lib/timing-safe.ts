import crypto from "crypto";

/**
 * Constant-time string comparison for shared secrets (agent keys, admin tokens).
 * Returns false when either side is missing/empty or the lengths differ.
 */
export function safeEqual(provided: string | null | undefined, expected: string | null | undefined): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
