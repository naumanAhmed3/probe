import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Probe — MCP Inspector',
  description:
    'A web client for the Model Context Protocol — connect to any MCP server, explore its tools, resources and prompts, invoke them, and watch the JSON-RPC traffic.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
