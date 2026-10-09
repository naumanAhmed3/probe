import { NextResponse } from 'next/server';
import { invoke } from '@/lib/mcp-client';
import type { InvokeKind } from '@/lib/types';
import { assertAllowedMcpUrl, authorize } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const KINDS: InvokeKind[] = ['tool', 'resource', 'prompt'];

// POST /api/invoke { url, kind, name, args } — call a tool / read a
// resource / render a prompt on an MCP server.
export async function POST(req: Request) {
  const unauthorized = authorize(req);
  if (unauthorized) return unauthorized;
  try {
    const { url, kind, name, args } = await req.json();
    if (!url || !KINDS.includes(kind) || !name) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    if (JSON.stringify(args ?? {}).length > 32_768) {
      return NextResponse.json({ error: 'Arguments are too large' }, { status: 413 });
    }
    const result = await invoke(assertAllowedMcpUrl(url).toString(), kind, name, args ?? {});
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Invocation failed' },
      { status: 500 },
    );
  }
}
