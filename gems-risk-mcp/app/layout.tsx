import { ReactNode } from 'react';
import { SpeedInsights } from '@vercel/speed-insights/next';

export const metadata = {
  title: 'GEMs Risk MCP Server',
  description: 'Model Context Protocol server for IFC Global Emerging Markets credit risk data',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
