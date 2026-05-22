'use client';

import { useState } from 'react';
import type {
  InspectResult,
  InvokeKind,
  InvokeResult,
  McpTool,
  RpcEntry,
} from '@/lib/types';

// ─────────────────────────────────────────────────────────────
// Probe — connect to an MCP server, browse its tools / resources /
// prompts, invoke them, and watch the JSON-RPC traffic.
// ─────────────────────────────────────────────────────────────

interface Selection {
  kind: InvokeKind;
  name: string;
}

export function Inspector({ defaultUrl }: { defaultUrl: string }) {
  const [url, setUrl] = useState(defaultUrl);
  const [connecting, setConnecting] = useState(false);
  const [connError, setConnError] = useState<string | null>(null);
  const [conn, setConn] = useState<InspectResult | null>(null);

  const [sel, setSel] = useState<Selection | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [invocation, setInvocation] = useState<InvokeResult | null>(null);
  const [rpc, setRpc] = useState<RpcEntry[]>([]);

  async function doConnect() {
    setConnecting(true);
    setConnError(null);
    setConn(null);
    setSel(null);
    setInvocation(null);
    setRpc([]);
    try {
      const res = await fetch('/api/inspect', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Connection failed');
      setConn(data);
      setRpc(data.rpcLog ?? []);
    } catch (e) {
      setConnError(e instanceof Error ? e.message : 'Connection failed');
    } finally {
      setConnecting(false);
    }
  }

  function select(kind: InvokeKind, name: string) {
    setSel({ kind, name });
    setInvocation(null);
    setForm({});
  }

  async function doInvoke() {
    if (!sel || !conn) return;
    setRunning(true);
    setInvocation(null);
    try {
      const tool =
        sel.kind === 'tool'
          ? conn.tools.find((t) => t.name === sel.name)
          : undefined;
      const args =
        sel.kind === 'resource' ? {} : coerceArgs(sel, tool, form);
      const res = await fetch('/api/invoke', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          kind: sel.kind,
          name: sel.name,
          args,
        }),
      });
      const data: InvokeResult = await res.json();
      setInvocation(data);
      setRpc(data.rpcLog ?? []);
    } catch (e) {
      setInvocation({
        ok: false,
        error: e instanceof Error ? e.message : 'Invocation failed',
        rpcLog: [],
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      {/* Connect bar */}
      <div className="flex items-center gap-2.5">
        <div className="flex-1 flex items-center gap-2.5 rounded-xl bg-surface ring-1 ring-edge focus-within:ring-brand/50 px-3.5 h-11 transition">
          <span className="text-[12px] font-mono text-neutral-600 shrink-0">
            MCP
          </span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doConnect()}
            placeholder="https://your-mcp-server/mcp"
            className="flex-1 bg-transparent outline-none text-[13px] font-mono placeholder:text-neutral-600"
          />
        </div>
        <button
          onClick={doConnect}
          disabled={connecting}
          className="h-11 px-5 rounded-xl bg-brand text-ink text-sm font-semibold hover:brightness-110 disabled:opacity-60 transition inline-flex items-center gap-2"
        >
          {connecting && (
            <span className="w-3.5 h-3.5 rounded-full border-2 border-ink/30 border-t-ink pb-spin" />
          )}
          Connect
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-[11px] text-neutral-600">try</span>
        <button
          onClick={() => setUrl(defaultUrl)}
          className="text-[11px] font-mono text-neutral-400 hover:text-brand"
        >
          {defaultUrl}
        </button>
      </div>

      {connError && (
        <p className="mt-4 rounded-lg bg-bad/10 ring-1 ring-bad/25 px-4 py-3 text-sm text-bad">
          {connError}
        </p>
      )}

      {!conn && !connError && (
        <p className="mt-10 text-center text-[13px] text-neutral-600">
          Connect to a Model Context Protocol server to inspect its tools,
          resources and prompts — and invoke them live.
        </p>
      )}

      {conn && (
        <div className="mt-5 pb-fade">
          {/* Server strip */}
          <div className="flex items-center gap-2.5 flex-wrap rounded-xl bg-surface ring-1 ring-edge px-4 py-2.5">
            <span className="w-2 h-2 rounded-full bg-brand" />
            <span className="text-[13px] font-medium text-neutral-100">
              {conn.server?.name ?? 'mcp-server'}
            </span>
            <span className="text-[11px] font-mono text-neutral-600">
              v{conn.server?.version ?? '?'}
            </span>
            <span className="ml-auto flex items-center gap-1.5">
              <Cap on={!!conn.capabilities?.tools} label="tools" />
              <Cap on={!!conn.capabilities?.resources} label="resources" />
              <Cap on={!!conn.capabilities?.prompts} label="prompts" />
            </span>
          </div>

          {/* Catalog + detail */}
          <div className="mt-4 grid lg:grid-cols-[260px_1fr] gap-4">
            {/* Sidebar */}
            <aside className="rounded-xl bg-surface ring-1 ring-edge p-2 h-fit">
              <CatalogGroup label="Tools" count={conn.tools.length}>
                {conn.tools.map((t) => (
                  <CatalogItem
                    key={t.name}
                    label={t.name}
                    active={sel?.kind === 'tool' && sel.name === t.name}
                    onClick={() => select('tool', t.name)}
                  />
                ))}
              </CatalogGroup>
              <CatalogGroup label="Resources" count={conn.resources.length}>
                {conn.resources.map((r) => (
                  <CatalogItem
                    key={r.uri}
                    label={r.name ?? r.uri}
                    sub={r.uri}
                    active={sel?.kind === 'resource' && sel.name === r.uri}
                    onClick={() => select('resource', r.uri)}
                  />
                ))}
              </CatalogGroup>
              <CatalogGroup label="Prompts" count={conn.prompts.length}>
                {conn.prompts.map((p) => (
                  <CatalogItem
                    key={p.name}
                    label={p.name}
                    active={sel?.kind === 'prompt' && sel.name === p.name}
                    onClick={() => select('prompt', p.name)}
                  />
                ))}
              </CatalogGroup>
            </aside>

            {/* Detail */}
            <section className="min-w-0">
              {!sel ? (
                <div className="rounded-xl border border-dashed border-edge px-6 py-14 text-center text-[13px] text-neutral-600">
                  Select a tool, resource or prompt to inspect and run it.
                </div>
              ) : (
                <Detail
                  conn={conn}
                  sel={sel}
                  form={form}
                  setForm={setForm}
                  running={running}
                  onInvoke={doInvoke}
                  invocation={invocation}
                />
              )}
            </section>
          </div>

          {/* JSON-RPC log */}
          {rpc.length > 0 && (
            <section className="mt-4">
              <h2 className="text-[11px] uppercase tracking-wide text-neutral-500 mb-2">
                JSON-RPC exchange · {rpc.length} frames
              </h2>
              <div className="rounded-xl bg-surface ring-1 ring-edge divide-y divide-edge-soft overflow-hidden">
                {rpc.map((e, i) => (
                  <RpcFrame key={i} entry={e} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}

// ── Detail panel ───────────────────────────────────────────
function Detail({
  conn,
  sel,
  form,
  setForm,
  running,
  onInvoke,
  invocation,
}: {
  conn: InspectResult;
  sel: Selection;
  form: Record<string, string>;
  setForm: (f: Record<string, string>) => void;
  running: boolean;
  onInvoke: () => void;
  invocation: InvokeResult | null;
}) {
  const tool =
    sel.kind === 'tool' ? conn.tools.find((t) => t.name === sel.name) : undefined;
  const resource =
    sel.kind === 'resource'
      ? conn.resources.find((r) => r.uri === sel.name)
      : undefined;
  const prompt =
    sel.kind === 'prompt'
      ? conn.prompts.find((p) => p.name === sel.name)
      : undefined;

  const description = tool?.description ?? resource?.description ?? prompt?.description;
  const verb =
    sel.kind === 'tool'
      ? 'Run tool'
      : sel.kind === 'resource'
        ? 'Read resource'
        : 'Get prompt';

  return (
    <div className="rounded-xl bg-surface ring-1 ring-edge p-4">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono uppercase tracking-wide text-brand bg-brand/10 ring-1 ring-brand/20 rounded px-1.5 py-0.5">
          {sel.kind}
        </span>
        <code className="text-[13.5px] font-mono text-neutral-100 break-all">
          {sel.name}
        </code>
      </div>
      {description && (
        <p className="mt-2 text-[12.5px] text-neutral-400 leading-relaxed">
          {description}
        </p>
      )}

      {/* Argument form */}
      <div className="mt-3.5 space-y-2.5">
        {tool && <ToolForm tool={tool} form={form} setForm={setForm} />}
        {prompt?.arguments?.map((a) => (
          <Field
            key={a.name}
            name={a.name}
            hint={a.description}
            required={a.required}
            value={form[a.name] ?? ''}
            onChange={(v) => setForm({ ...form, [a.name]: v })}
          />
        ))}
        {sel.kind === 'resource' && (
          <p className="text-[12px] text-neutral-600">No arguments.</p>
        )}
      </div>

      <button
        onClick={onInvoke}
        disabled={running}
        className="mt-4 h-9 px-4 rounded-lg bg-brand text-ink text-[13px] font-semibold hover:brightness-110 disabled:opacity-60 transition inline-flex items-center gap-2"
      >
        {running && (
          <span className="w-3 h-3 rounded-full border-2 border-ink/30 border-t-ink pb-spin" />
        )}
        {verb}
      </button>

      {/* Result */}
      {invocation && (
        <div className="mt-4">
          <div className="text-[11px] uppercase tracking-wide text-neutral-500 mb-1.5">
            Result
          </div>
          {invocation.ok ? (
            <pre className="rounded-lg bg-ink ring-1 ring-edge px-3.5 py-3 text-[12px] font-mono text-neutral-300 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-96">
              {renderResult(sel.kind, invocation.result)}
            </pre>
          ) : (
            <pre className="rounded-lg bg-bad/10 ring-1 ring-bad/25 px-3.5 py-3 text-[12px] font-mono text-bad overflow-x-auto whitespace-pre-wrap">
              {invocation.error}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function ToolForm({
  tool,
  form,
  setForm,
}: {
  tool: McpTool;
  form: Record<string, string>;
  setForm: (f: Record<string, string>) => void;
}) {
  const props = (tool.inputSchema?.properties ?? {}) as Record<string, any>;
  const required: string[] = tool.inputSchema?.required ?? [];
  const keys = Object.keys(props);
  if (keys.length === 0) {
    return <p className="text-[12px] text-neutral-600">No arguments.</p>;
  }
  return (
    <>
      {keys.map((k) => {
        const p = props[k];
        const hint = [p.type, p.description].filter(Boolean).join(' · ');
        return (
          <Field
            key={k}
            name={k}
            hint={hint}
            required={required.includes(k)}
            enumValues={p.enum}
            value={form[k] ?? ''}
            onChange={(v) => setForm({ ...form, [k]: v })}
          />
        );
      })}
    </>
  );
}

function Field({
  name,
  hint,
  required,
  enumValues,
  value,
  onChange,
}: {
  name: string;
  hint?: string;
  required?: boolean;
  enumValues?: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[12px] font-mono text-neutral-300">
        {name}
        {required && <span className="text-brand"> *</span>}
        {hint && (
          <span className="text-[11px] text-neutral-600 font-sans"> — {hint}</span>
        )}
      </span>
      {enumValues ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full h-9 rounded-lg bg-ink ring-1 ring-edge px-2.5 text-[13px] outline-none focus:ring-brand/50"
        >
          <option value="">— choose —</option>
          {enumValues.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full h-9 rounded-lg bg-ink ring-1 ring-edge px-3 text-[13px] outline-none focus:ring-brand/50"
        />
      )}
    </label>
  );
}

// ── JSON-RPC frame ─────────────────────────────────────────
function RpcFrame({ entry }: { entry: RpcEntry }) {
  const out = entry.dir === 'out';
  const m = entry.message ?? {};
  const summary =
    m.method != null
      ? m.method
      : m.result != null
        ? `result #${m.id}`
        : m.error != null
          ? `error #${m.id}`
          : `#${m.id ?? '?'}`;
  return (
    <details className="bg-surface group">
      <summary className="flex items-center gap-2.5 px-3.5 py-2 cursor-pointer list-none">
        <span
          className={`text-[11px] font-mono ${out ? 'text-out' : 'text-in'}`}
        >
          {out ? '▲ request' : '▼ response'}
        </span>
        <code className="text-[12px] font-mono text-neutral-300">{summary}</code>
        <span className="ml-auto text-[10px] text-neutral-600 group-open:hidden">
          expand
        </span>
      </summary>
      <pre className="px-3.5 pb-3 text-[11px] font-mono text-neutral-400 overflow-x-auto leading-relaxed">
        {JSON.stringify(m, null, 2)}
      </pre>
    </details>
  );
}

function Cap({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={`text-[10.5px] font-mono rounded px-1.5 py-0.5 ring-1 ${
        on
          ? 'text-brand bg-brand/10 ring-brand/20'
          : 'text-neutral-600 ring-edge'
      }`}
    >
      {label}
    </span>
  );
}

function CatalogGroup({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-1">
      <div className="px-2 py-1.5 text-[10.5px] uppercase tracking-wide text-neutral-500 flex items-center justify-between">
        <span>{label}</span>
        <span className="font-mono">{count}</span>
      </div>
      {count === 0 ? (
        <p className="px-2 pb-1.5 text-[11px] text-neutral-700">none</p>
      ) : (
        <div className="space-y-0.5">{children}</div>
      )}
    </div>
  );
}

function CatalogItem({
  label,
  sub,
  active,
  onClick,
}: {
  label: string;
  sub?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-2 py-1.5 rounded-md transition ${
        active ? 'bg-brand/15 ring-1 ring-brand/30' : 'hover:bg-surface-2'
      }`}
    >
      <div
        className={`text-[12.5px] font-mono truncate ${
          active ? 'text-brand' : 'text-neutral-300'
        }`}
      >
        {label}
      </div>
      {sub && (
        <div className="text-[10px] font-mono text-neutral-600 truncate">
          {sub}
        </div>
      )}
    </button>
  );
}

// ── Helpers ────────────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */

function coerceArgs(
  sel: Selection,
  tool: McpTool | undefined,
  form: Record<string, string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const props = (tool?.inputSchema?.properties ?? {}) as Record<string, any>;
  for (const [k, v] of Object.entries(form)) {
    if (v === '') continue;
    const type = props[k]?.type;
    if (type === 'number' || type === 'integer') out[k] = Number(v);
    else if (type === 'boolean') out[k] = v === 'true';
    else out[k] = v;
  }
  return out;
}

function renderResult(kind: InvokeKind, result: any): string {
  if (!result) return '(empty)';
  try {
    if (kind === 'tool' && Array.isArray(result.content)) {
      const text = result.content
        .map((c: any) => (c.type === 'text' ? c.text : JSON.stringify(c)))
        .join('\n');
      return (result.isError ? '[tool error]\n' : '') + text;
    }
    if (kind === 'resource' && Array.isArray(result.contents)) {
      return result.contents
        .map((c: any) => c.text ?? `[${c.mimeType ?? 'binary'}]`)
        .join('\n\n');
    }
    if (kind === 'prompt' && Array.isArray(result.messages)) {
      return result.messages
        .map(
          (m: any) =>
            `[${m.role}]\n${m.content?.text ?? JSON.stringify(m.content)}`,
        )
        .join('\n\n');
    }
  } catch {
    /* fall through to raw JSON */
  }
  return JSON.stringify(result, null, 2);
}
