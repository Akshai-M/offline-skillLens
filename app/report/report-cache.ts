import type { Report } from "@/lib/feedback";

// Per-viewer cache of the last fetched report, kept in this browser only.
// It is cleared on sign out. Refresh replaces it with a new fetch from the server.

export type CachedReport = { report: Report; fetchedAt: string };

const KEY_PREFIX = "report-cache:";
const EVENT = "report-cache-changed";

// Keeps the cache working for this page visit when storage is blocked (private mode).
const memory = new Map<string, string>();

function keyFor(email: string): string {
  return `${KEY_PREFIX}${email}`;
}

export function readCacheRaw(email: string): string | null {
  const key = keyFor(email);
  const remembered = memory.get(key);
  if (remembered !== undefined) return remembered;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeCache(email: string, value: CachedReport) {
  const key = keyFor(email);
  const raw = JSON.stringify(value);
  memory.set(key, raw);
  try {
    window.localStorage.setItem(key, raw);
  } catch {
    // Storage blocked: the report stays for this page visit only.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeCache(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

export function parseCache(raw: string | null): CachedReport | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (
      value &&
      typeof value === "object" &&
      "fetchedAt" in value &&
      typeof value.fetchedAt === "string" &&
      "report" in value &&
      value.report &&
      typeof value.report === "object" &&
      "summary" in value.report &&
      typeof value.report.summary === "string"
    ) {
      return value as CachedReport;
    }
  } catch {
    // Corrupt entry: treat as empty so the report is fetched again.
  }
  return null;
}

export function clearReportCaches() {
  memory.clear();
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(KEY_PREFIX)) window.localStorage.removeItem(key);
    }
  } catch {
    // Storage blocked: nothing persisted to clear.
  }
  window.dispatchEvent(new Event(EVENT));
}
