const map = new Map<string, { count: number; resetAt: number }>();
const LIMIT = 10;
const WINDOW_MS = 60_000;

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = map.get(ip);
  if (!entry || now > entry.resetAt) {
    map.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= LIMIT) return false;
  entry.count++;
  return true;
}
