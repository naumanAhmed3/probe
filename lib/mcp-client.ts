import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { InspectResult, InvokeKind, InvokeResult, RpcEntry } from './types';

// ─────────────────────────────────────────────────────────────
// The MCP client. Each operation opens a fresh Streamable-HTTP
// connection, runs, and closes — stateless, which suits both
// serverless and the inspector's request/response model.
//
// Every operation also records the JSON-RPC request/response pair it
// exchanged, so the UI can show the wire-level protocol traffic.
// ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

const PROTOCOL_VERSION = '2025-06-18';

/** Accumulates the JSON-RPC frames for one connection. */
class RpcLog {
  readonly entries: RpcEntry[] = [];
  private id = 0;

  request(method: string, params: unknown): number {
    const id = ++this.id;
    this.entries.push({
      dir: 'out',
      message: { jsonrpc: '2.0', id, method, params },
    });
    return id;
  }

  response(id: number, result: unknown): void {
    this.entries.push({ dir: 'in', message: { jsonrpc: '2.0', id, result } });
  }
}

function newClient(url: string): { client: Client; transport: StreamableHTTPClientTransport } {
  return {
    client: new Client({ name: 'probe', version: '1.0.0' }),
    transport: new StreamableHTTPClientTransport(new URL(url)),
  };
}

/** Connect to an MCP server and enumerate everything it offers. */
export async function inspect(url: string): Promise<InspectResult> {
  const { client, transport } = newClient(url);
  const log = new RpcLog();

  try {
    const initId = log.request('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'probe', version: '1.0.0' },
    });
    await client.connect(transport);
    const capabilities = client.getServerCapabilities() as
      | Record<string, unknown>
      | undefined;
    const server = client.getServerVersion();
    log.response(initId, {
      protocolVersion: PROTOCOL_VERSION,
      serverInfo: server,
      capabilities,
    });

    let tools: any[] = [];
    if (capabilities?.tools) {
      const id = log.request('tools/list', {});
      const r = await client.listTools();
      tools = r.tools;
      log.response(id, r);
    }

    let resources: any[] = [];
    if (capabilities?.resources) {
      const id = log.request('resources/list', {});
      const r = await client.listResources();
      resources = r.resources;
      log.response(id, r);
    }

    let prompts: any[] = [];
    if (capabilities?.prompts) {
      const id = log.request('prompts/list', {});
      const r = await client.listPrompts();
      prompts = r.prompts;
      log.response(id, r);
    }

    return { server, capabilities, tools, resources, prompts, rpcLog: log.entries };
  } finally {
    await client.close().catch(() => {});
  }
}

/** Invoke a tool, read a resource, or render a prompt. */
export async function invoke(
  url: string,
  kind: InvokeKind,
  name: string,
  args: Record<string, unknown>,
): Promise<InvokeResult> {
  const { client, transport } = newClient(url);
  const log = new RpcLog();

  try {
    const initId = log.request('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'probe', version: '1.0.0' },
    });
    await client.connect(transport);
    log.response(initId, {
      protocolVersion: PROTOCOL_VERSION,
      serverInfo: client.getServerVersion(),
    });

    const [method, params] =
      kind === 'tool'
        ? ['tools/call', { name, arguments: args }]
        : kind === 'resource'
          ? ['resources/read', { uri: name }]
          : ['prompts/get', { name, arguments: args }];

    const id = log.request(method, params);
    let result: unknown;
    if (kind === 'tool') {
      result = await client.callTool({ name, arguments: args });
    } else if (kind === 'resource') {
      result = await client.readResource({ uri: name });
    } else {
      result = await client.getPrompt({ name, arguments: args as any });
    }
    log.response(id, result);

    return { ok: true, result, rpcLog: log.entries };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      rpcLog: log.entries,
    };
  } finally {
    await client.close().catch(() => {});
  }
}
