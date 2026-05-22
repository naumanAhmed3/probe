import { Inspector } from './inspector';

export const dynamic = 'force-dynamic';

const CONDUIT = 'https://conduit-orpin.vercel.app/mcp';

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Masthead */}
      <header className="border-b border-line">
        <div className="max-w-6xl mx-auto px-7 h-16 flex items-baseline gap-4">
          <span className="font-display text-[26px] font-semibold tracking-[-0.02em] leading-none self-center">
            Probe
          </span>
          <span className="hidden sm:block font-display italic text-[15px] text-muted self-center">
            a client &amp; inspector for the Model Context Protocol
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-7 py-10">
        <Inspector defaultUrl={CONDUIT} />
      </main>
    </div>
  );
}
