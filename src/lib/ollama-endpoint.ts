import { env } from "./env";

/**
 * SSRF guard for the Ollama endpoint.
 *
 * Tenants can configure their own Ollama endpoint, and the server POSTs telemetry to it.
 * Without an allow-list that is a server-side request forgery primitive (cloud metadata,
 * internal services). Only hosts listed in OLLAMA_ALLOWED_HOSTS (comma-separated hostnames
 * or host:port pairs, default: localhost,127.0.0.1) plus the host of the operator-set
 * OLLAMA_HOST may be contacted.
 */

export function getDefaultOllamaEndpoint(): string {
  return env("OLLAMA_HOST", "http://localhost:11434");
}

export function getAllowedOllamaHosts(): string[] {
  const allowed = env("OLLAMA_ALLOWED_HOSTS", "localhost,127.0.0.1")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter((h) => h.length > 0);

  // The operator-controlled default endpoint is always allowed.
  try {
    allowed.push(new URL(getDefaultOllamaEndpoint()).host.toLowerCase());
  } catch {
    // Malformed OLLAMA_HOST: nothing extra is allowed.
  }
  return allowed;
}

export function isAllowedOllamaEndpoint(endpoint: string | undefined | null): boolean {
  if (!endpoint) return false;

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (url.username || url.password) return false;

  const allowed = getAllowedOllamaHosts();
  return allowed.includes(url.hostname.toLowerCase()) || allowed.includes(url.host.toLowerCase());
}
