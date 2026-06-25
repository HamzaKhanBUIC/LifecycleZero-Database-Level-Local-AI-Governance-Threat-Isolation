/**
 * Strips UTF-8 BOM (\uFEFF) and surrounding whitespace from an env var value.
 * PowerShell's pipe operator injects a BOM into every value passed via stdin,
 * corrupting AWS credentials, table names, and queue URLs.
 */
export const env = (key: string, fallback = ""): string =>
  (process.env[key] ?? fallback).replace(/^\uFEFF/, "").trim();
