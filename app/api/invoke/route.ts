import { NextResponse } from 'next/server';
import { invoke } from '@/lib/mcp-client';
import type { InvokeKind } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const KINDS: InvokeKind[] = ['tool', 'resource', 'prompt'];

// POST /api/invoke { url, kind, name, args } — call a tool / read a
// resource / render a prompt on an MCP server.
export async function POST(req: Request) {
  try {
    const { url, kind, name, args } = await req.json();
    if (!url || !KINDS.includes(kind) || !name) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    const result = await invoke(url, kind, name, args ?? {});
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Invocation failed' },
      { status: 500 },
    );
  }
}
