# Probe — MCP Inspector

Probe is a web **client for the Model Context Protocol**. Point it at any MCP
server, and it connects, enumerates the server's **tools, resources and
prompts**, lets you invoke them through auto-generated forms, and shows the
**JSON-RPC traffic** for every exchange.

**Live demo:** https://probe-topaz.vercel.app

> It opens pre-pointed at [Conduit](https://github.com/naumanAhmed3/conduit),
> a companion MCP server — press **Connect** and start exploring.

---

## What it does

1. **Connect** — give it any Streamable-HTTP MCP endpoint. Probe runs the MCP
   `initialize` handshake and reads the server's capabilities.
2. **Browse** — every tool, resource and prompt the server advertises is
   listed in the catalog.
3. **Invoke** —
   - **Tools** get a form generated from their JSON-Schema `inputSchema`
     (enums become dropdowns, types are coerced on submit).
   - **Resources** are read by URI.
   - **Prompts** are rendered with their declared arguments.
4. **Inspect** — every operation shows the **JSON-RPC request/response
   frames** it exchanged, so you can see the protocol on the wire.

It is, in short, a browser-based version of the MCP Inspector — useful for
developing and debugging any MCP server.

---

## How it works

```
  Browser ──▶ Next.js (App Router) on Vercel
                │
                ├─ POST /api/inspect  { url }
                ├─ POST /api/invoke   { url, kind, name, args }
                │       │
                │       └─ lib/mcp-client.ts
                │            @modelcontextprotocol/sdk  Client
                │            + StreamableHTTPClientTransport
                │
                └────────Streamable HTTP────▶  any MCP server
```

The MCP client runs **server-side** in Next.js route handlers — the official
TypeScript SDK is a Node client, and proxying through the server also sidesteps
browser CORS. Each request opens a fresh stateless connection, runs, and
closes; the route returns the results together with the JSON-RPC log.

---

## Tech stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **`@modelcontextprotocol/sdk`** — MCP `Client` + Streamable HTTP transport
- **Tailwind CSS v4** · **Vercel** hosting

---

## Project structure

```
probe/
├── lib/
│   ├── mcp-client.ts   connect · inspect · invoke + JSON-RPC logging
│   └── types.ts
├── app/
│   ├── page.tsx               the shell
│   ├── inspector.tsx          the inspector UI (catalog · forms · RPC log)
│   └── api/
│       ├── inspect/route.ts   enumerate a server
│       └── invoke/route.ts    call a tool / read a resource / get a prompt
```

---

## Run it locally

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000 and connect to any MCP server — for example the
local Conduit dev server at `http://localhost:3000/mcp`, or any public one.

---

## Notes

- Probe speaks **Streamable HTTP**, the current MCP transport. SSE (the earlier
  transport) is intentionally not supported — it has been removed from the spec.
- Tool argument forms are generated from each tool's JSON Schema, so Probe
  adapts to any server without per-server code.

---

## License

MIT
