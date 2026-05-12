function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function domainGradient(domain: string): string {
  const h = hash(domain || "swipertab");
  const hue1 = h % 360;
  const hue2 = (hue1 + 30 + (h % 30)) % 360;
  return `linear-gradient(135deg, hsl(${hue1} 70% 60%), hsl(${hue2} 75% 55%))`;
}
