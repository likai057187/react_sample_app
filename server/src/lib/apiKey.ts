import crypto from 'node:crypto';
import type { FastifyRequest } from 'fastify';

export function timingSafeEqualString(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  try {
    const ba = Buffer.from(a, 'utf8');
    const bb = Buffer.from(b, 'utf8');
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export function parseApiKeyFromFastifyRequest(request: FastifyRequest): string {
  const x = request.headers['x-api-key'];
  if (typeof x === 'string' && x.trim()) return x.trim();
  const auth = request.headers.authorization;
  if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  const raw = request.url ?? '';
  const q = raw.indexOf('?');
  if (q >= 0) {
    try {
      const v = new URLSearchParams(raw.slice(q + 1)).get('apiKey');
      if (v) return v.trim();
    } catch {
      /* ignore */
    }
  }
  return '';
}
