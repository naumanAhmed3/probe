// ─────────────────────────────────────────────────────────────
// Probe — shared types. Loose mirrors of the MCP SDK shapes.
// ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface RpcEntry {
  dir: 'out' | 'in';
  message: any;
}

export interface McpTool {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: any;
}

export interface McpResource {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

export interface McpPromptArg {
  name: string;
  description?: string;
  required?: boolean;
}

export interface McpPrompt {
  name: string;
  title?: string;
  description?: string;
  arguments?: McpPromptArg[];
}

export interface InspectResult {
  server: { name?: string; version?: string } | undefined;
  capabilities: Record<string, unknown> | undefined;
  tools: McpTool[];
  resources: McpResource[];
  prompts: McpPrompt[];
  rpcLog: RpcEntry[];
}

export type InvokeKind = 'tool' | 'resource' | 'prompt';

export interface InvokeResult {
  ok: boolean;
  result?: any;
  error?: string;
  rpcLog: RpcEntry[];
}
