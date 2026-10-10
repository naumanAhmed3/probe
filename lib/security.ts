import { createHash, timingSafeEqual } from 'node:crypto';

export function authorize(req: Request): Response | null {
  const expected = process.env.PROBE_API_TOKEN;
  if (!expected) return Response.json({ error: 'Probe authentication is not configured' }, { status: 503 });
  const header = req.headers.get('authorization') ?? '';
  const supplied = header.startsWith('Bearer ') ? header.slice(7) : '';
  const a = createHash('sha256').update(supplied).digest();
  const b = createHash('sha256').update(expected).digest();
  if (!supplied || !timingSafeEqual(a, b)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  return null;
}

export function assertAllowedMcpUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== 'https:') throw new Error('MCP endpoint must use HTTPS');
  if (url.username || url.password) throw new Error('URL credentials are not allowed');
  const allowed = (process.env.MCP_ALLOWED_HOSTS ?? '').split(',').map((v) => v.trim().toLowerCase()).filter(Boolean);
  if (!allowed.length || !allowed.includes(url.hostname.toLowerCase())) {
    throw new Error('MCP endpoint host is not allowlisted');
  }
  return url;
}
