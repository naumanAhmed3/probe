import { NextResponse } from 'next/server';
import { inspect } from '@/lib/mcp-client';
import { assertAllowedMcpUrl, authorize } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// POST /api/inspect { url } — connect to an MCP server and list everything.
export async function POST(req: Request) {
  const unauthorized = authorize(req);
  if (unauthorized) return unauthorized;
  let url = '';
  try {
    ({ url } = await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  try {
    return NextResponse.json(await inspect(assertAllowedMcpUrl(url).toString()));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Connection failed' },
      { status: 502 },
    );
  }
}
