export function memberAvatarColor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) & 0xff_ff;
  const hue = (hash % 12) * 30;
  return `hsl(${hue}, 65%, 42%)`;
}
