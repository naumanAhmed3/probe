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
// prompts, invoke them, and read the JSON-RPC traffic.
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
      const args = sel.kind === 'resource' ? {} : coerceArgs(tool, form);
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
      {/* Hero + connect */}
      <section className="rise">
        <h1 className="font-display text-[38px] sm:text-[46px] leading-[1.08] tracking-[-0.025em] font-semibold max-w-xl">
          Inspect any <span className="italic text-accent">MCP</span> server.
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-muted max-w-lg">
          Connect over Streamable HTTP, browse the tools, resources and prompts
          a server offers, invoke them, and read the JSON-RPC on the wire.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            doConnect();
          }}
          className="mt-6 flex items-stretch gap-2.5 max-w-2xl"
        >
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-mcp-server/mcp"
            className="flex-1 h-12 rounded-lg bg-card border border-line px-4 text-[13.5px] font-mono outline-none transition placeholder:text-muted focus:border-accent"
          />
          <button
            type="submit"
            disabled={connecting}
            className="h-12 px-6 rounded-lg bg-accent text-card text-[14px] font-medium hover:opacity-90 disabled:opacity-50 transition inline-flex items-center gap-2.5"
          >
            {connecting && (
              <span className="w-3.5 h-3.5 rounded-full border-2 border-card/40 border-t-card spin" />
            )}
            Connect
          </button>
        </form>
        <button
          onClick={() => setUrl(defaultUrl)}
          className="mt-2 text-[12px] text-muted hover:text-accent transition"
        >
          try the Conduit server →
        </button>
      </section>

      {connError && (
        <p className="mt-6 rounded-md bg-card border border-line px-5 py-4 text-[14px] text-bad">
          {connError}
        </p>
      )}

      {conn && (
        <div className="mt-9 rise">
          {/* Server strip */}
          <div className="flex items-baseline gap-3 flex-wrap pb-3 border-b border-line">
            <h2 className="font-display text-[22px] tracking-[-0.015em]">
              {conn.server?.name ?? 'mcp-server'}
            </h2>
            <span className="font-mono text-[12px] text-muted">
              v{conn.server?.version ?? '?'}
            </span>
            <span className="ml-auto flex items-center gap-1.5">
              <Cap on={!!conn.capabilities?.tools} label="tools" />
              <Cap on={!!conn.capabilities?.resources} label="resources" />
              <Cap on={!!conn.capabilities?.prompts} label="prompts" />
            </span>
          </div>

          {/* Catalog + detail */}
          <div className="mt-6 grid lg:grid-cols-[240px_1fr] gap-7">
            <aside className="h-fit">
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

            <section className="min-w-0">
              {!sel ? (
                <p className="font-display italic text-[16px] text-muted pt-4">
                  Select a tool, resource or prompt to inspect and run it.
                </p>
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
            <section className="mt-9">
              <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted mb-2.5">
                JSON-RPC exchange · {rpc.length} frames
              </h3>
              <div className="rounded-lg bg-code overflow-hidden">
                {rpc.map((e, i) => (
                  <RpcFrame key={i} entry={e} last={i === rpc.length - 1} />
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

  const description =
    tool?.description ?? resource?.description ?? prompt?.description;
  const verb =
    sel.kind === 'tool'
      ? 'Run tool'
      : sel.kind === 'resource'
        ? 'Read resource'
        : 'Get prompt';

  return (
    <div>
      <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted">
        {sel.kind}
      </div>
      <code className="mt-1 block font-mono text-[18px] text-ink break-all">
        {sel.name}
      </code>
      {description && (
        <p className="mt-2 text-[13.5px] text-ink/70 leading-relaxed">
          {description}
        </p>
      )}

      {/* Argument form */}
      <div className="mt-5 space-y-3">
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
          <p className="text-[12.5px] text-muted italic font-display">
            This resource takes no arguments.
          </p>
        )}
      </div>

      <button
        onClick={onInvoke}
        disabled={running}
        className="mt-5 h-10 px-5 rounded-lg bg-accent text-card text-[13px] font-medium hover:opacity-90 disabled:opacity-50 transition inline-flex items-center gap-2"
      >
        {running && (
          <span className="w-3 h-3 rounded-full border-2 border-card/40 border-t-card spin" />
        )}
        {verb}
      </button>

      {/* Result */}
      {invocation && (
        <div className="mt-5">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted mb-1.5">
            Result
          </div>
          <pre
            className={`rounded-lg px-4 py-3.5 font-mono text-[12px] overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[28rem] ${
              invocation.ok
                ? 'bg-code text-[#cdc8bd]'
                : 'bg-card border border-line text-bad'
            }`}
          >
            {invocation.ok
              ? renderResult(sel.kind, invocation.result)
              : invocation.error}
          </pre>
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
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const props = (tool.inputSchema?.properties ?? {}) as Record<string, any>;
  const required: string[] = tool.inputSchema?.required ?? [];
  const keys = Object.keys(props);
  if (keys.length === 0) {
    return (
      <p className="text-[12.5px] text-muted italic font-display">
        This tool takes no arguments.
      </p>
    );
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
      <span className="text-[12.5px]">
        <span className="font-mono text-ink">{name}</span>
        {required && <span className="text-accent"> *</span>}
        {hint && <span className="text-muted"> — {hint}</span>}
      </span>
      {enumValues ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1.5 w-full h-10 rounded-lg bg-card border border-line px-3 text-[13.5px] outline-none focus:border-accent transition"
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
          className="mt-1.5 w-full h-10 rounded-lg bg-card border border-line px-3.5 text-[13.5px] outline-none focus:border-accent transition"
        />
      )}
    </label>
  );
}

// ── JSON-RPC frame ─────────────────────────────────────────
function RpcFrame({ entry, last }: { entry: RpcEntry; last: boolean }) {
  const out = entry.dir === 'out';
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const m: any = entry.message ?? {};
  const summary =
    m.method != null
      ? m.method
      : m.result != null
        ? `result #${m.id}`
        : m.error != null
          ? `error #${m.id}`
          : `#${m.id ?? '?'}`;
  return (
    <details className={last ? '' : 'border-b border-white/10'}>
      <summary className="flex items-center gap-3 px-4 py-2.5 cursor-pointer">
        <span
          className="font-mono text-[10px] uppercase tracking-[0.12em]"
          style={{ color: out ? 'var(--color-out)' : 'var(--color-in)' }}
        >
          {out ? 'request →' : '← response'}
        </span>
        <code className="font-mono text-[12.5px] text-[#cdc8bd]">{summary}</code>
      </summary>
      <pre className="px-4 pb-3.5 font-mono text-[11px] leading-relaxed text-white/45 overflow-x-auto">
        {JSON.stringify(m, null, 2)}
      </pre>
    </details>
  );
}

function Cap({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={`font-mono text-[10.5px] uppercase tracking-[0.1em] px-2 py-0.5 rounded ${
        on ? 'text-accent bg-accent/8' : 'text-muted/60'
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
    <div className="mb-5">
      <div className="flex items-baseline justify-between pb-1.5 mb-1.5 border-b border-line">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted">
          {label}
        </span>
        <span className="font-mono text-[11px] text-muted">{count}</span>
      </div>
      {count === 0 ? (
        <p className="text-[12px] text-muted/60 italic font-display">none</p>
      ) : (
        <div className="space-y-px">{children}</div>
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
      className={`w-full text-left px-2.5 py-1.5 rounded-md transition ${
        active ? 'bg-accent/10' : 'hover:bg-line-soft'
      }`}
    >
      <div
        className={`font-mono text-[12.5px] truncate ${
          active ? 'text-accent' : 'text-ink/75'
        }`}
      >
        {label}
      </div>
      {sub && (
        <div className="font-mono text-[10px] text-muted truncate">{sub}</div>
      )}
    </button>
  );
}

// ── Helpers ────────────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */

function coerceArgs(
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
          (msg: any) =>
            `[${msg.role}]\n${msg.content?.text ?? JSON.stringify(msg.content)}`,
        )
        .join('\n\n');
    }
  } catch {
    /* fall through to raw JSON */
  }
  return JSON.stringify(result, null, 2);
}
