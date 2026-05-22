import { Inspector } from './inspector';

export const dynamic = 'force-dynamic';

const CONDUIT = 'https://conduit-orpin.vercel.app/mcp';

export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-edge-soft">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <span className="grid place-items-center w-9 h-9 rounded-lg bg-brand/15 ring-1 ring-brand/30 text-brand">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.4-3.4" />
              <path d="M11 8v6M8 11h6" />
            </svg>
          </span>
          <div>
            <h1 className="font-semibold tracking-tight leading-tight">Probe</h1>
            <p className="text-[11.5px] text-neutral-500 leading-tight">
              a web client &amp; inspector for the Model Context Protocol
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-7">
        <Inspector defaultUrl={CONDUIT} />
      </main>
    </div>
  );
}
