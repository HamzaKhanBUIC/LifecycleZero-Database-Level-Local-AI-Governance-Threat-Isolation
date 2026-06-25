/**
 * POST /api/webhooks/rotate-key
 *
 * Agent API key rotation endpoint.
 *
 * In a production deployment, this would:
 *   1. Generate a new cryptographically-random API key
 *   2. Write it to AWS Secrets Manager (aws-sdk/client-secrets-manager)
 *   3. Trigger a rolling restart of the edge functions so the new key is picked up
 *   4. Return the new key (once, in this response) for the MDM to distribute to agents
 *
 * For the demo deployment, the key lives in Vercel environment variables.
 * We demonstrate the rotation flow: validate the caller's admin token,
 * generate a new key, and return it — the Vercel API call to persist it
 * is stubbed with a clear comment indicating the production path.
 *
 * Authentication: requires the X-Admin-Token header to match ADMIN_ROTATION_SECRET.
 * This endpoint is intentionally NOT rate-limited by IP (it's admin-only)
 * but should be called at most once per rotation event.
 */
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import crypto from "node:crypto";

/**
 * Generate a URL-safe random API key: 32 hex-encoded random bytes (64 chars).
 */
function generateApiKey(): string {
  return "lz_agent_" + crypto.randomBytes(32).toString("hex");
}

export async function POST(request: Request) {
  try {
    // 1. Authenticate the rotation caller
    const adminToken = request.headers.get("x-admin-token");
    const expectedAdminToken = env("ADMIN_ROTATION_SECRET", "admin_rotation_secret_demo");

    if (!adminToken || adminToken !== expectedAdminToken) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Invalid or missing X-Admin-Token header." },
        { status: 401 }
      );
    }

    // 2. Parse optional metadata from the body
    const body = await request.json().catch(() => ({}));
    const { reason = "Manual rotation request", requestedBy = "ADMIN_PORTAL" } = body;

    // 3. Generate new API key
    const newKey = generateApiKey();
    const rotatedAt = new Date().toISOString();

    // 4. Production path: persist to AWS Secrets Manager
    // In production, uncomment the following block and remove the stub:
    //
    //   import { SecretsManagerClient, UpdateSecretCommand } from "@aws-sdk/client-secrets-manager";
    //   const smClient = new SecretsManagerClient({ region: env("AWS_REGION", "us-east-1") });
    //   await smClient.send(new UpdateSecretCommand({
    //     SecretId: "lifecyclezero/agent-api-key",
    //     SecretString: newKey,
    //   }));
    //
    // Then trigger a Vercel environment variable update via the Vercel API:
    //   await fetch(`https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/env`, {
    //     method: "POST",
    //     headers: { Authorization: `Bearer ${env("VERCEL_TOKEN")}` },
    //     body: JSON.stringify({ key: "AGENT_API_KEY", value: newKey, target: ["production"] })
    //   });
    //
    // DEMO: The key is generated and returned. Operators copy it to Vercel dashboard manually.
    // MDM (Jamf/Intune) distributes it to agents on next configuration sync.

    console.log(`[KEY_ROTATION] New key generated at ${rotatedAt}. Reason: ${reason}. Requested by: ${requestedBy}.`);

    // 5. Respond with the new key (this is the only time it will be visible in plaintext)
    return NextResponse.json(
      {
        success: true,
        message: "API key rotated successfully. Distribute the new key to agents via MDM before the old key is deactivated.",
        rotatedAt,
        reason,
        requestedBy,
        // In production: the key would be written to AWS Secrets Manager and NOT returned here.
        // For the demo, we return it once so you can copy it to Vercel env vars.
        newKey,
        instructions: {
          step1: "Copy newKey to AGENT_API_KEY in Vercel → Settings → Environment Variables",
          step2: "Redeploy to pick up the new key (Vercel → Deployments → Redeploy)",
          step3: "Trigger Jamf/Intune MDM configuration push to distribute to all agents",
          step4: "Confirm agents are using the new key by checking /api/ingest response headers",
          productionPath: "AWS Secrets Manager → Secrets rotation → Lambda trigger → Vercel API",
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[KEY_ROTATION] Error:", error);
    return NextResponse.json(
      { error: "ROTATION_FAILED", message: error.message || "Unexpected error during key rotation." },
      { status: 500 }
    );
  }
}
