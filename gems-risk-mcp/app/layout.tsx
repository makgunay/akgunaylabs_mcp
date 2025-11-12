import { ReactNode } from 'react';
import Script from 'next/script';

const isProduction = process.env.NODE_ENV === 'production';

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
        {isProduction ? (
          <Script src="/_vercel/insights/script.js" strategy="afterInteractive" />
        ) : null}
      </body>
    </html>
  );
}
