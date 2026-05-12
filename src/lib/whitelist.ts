export function matchesDomain(host: string, list: string[]): boolean {
  if (!host) return false;
  for (const raw of list) {
    const d = raw.trim().toLowerCase();
    if (!d) continue;
    if (host === d || host.endsWith("." + d)) return true;
  }
  return false;
}
