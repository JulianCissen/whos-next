import { randomBytes } from 'node:crypto';

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

// 232 = 58 * floor(256 / 58) — bytes >= this threshold are rejected to avoid modulo bias
const REJECTION_THRESHOLD = 58 * Math.floor(256 / 58);

export function generateSlug(): string {
  const result: string[] = [];
  while (result.length < 8) {
    const bytes = randomBytes(16);
    for (const byte of bytes) {
      if (byte >= REJECTION_THRESHOLD) continue;
      result.push(BASE58_ALPHABET[byte % 58]);
      if (result.length === 8) break;
    }
  }
  return result.join('');
}
