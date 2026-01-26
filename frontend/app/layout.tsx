import type { Metadata } from 'next';
import './globals.css';
import dynamic from 'next/dynamic';

// Dynamically import Providers with SSR disabled to prevent IndexedDB errors
const Providers = dynamic(() => import('./providers').then(mod => ({ default: mod.Providers })), {
  ssr: false,
});

export const metadata: Metadata = {
  title: 'FLIP Protocol - Instant FAsset Redemptions on Flare',
  description: 'Accelerate your FAsset redemptions with trust-minimized instant settlement. Powered by Flare Data Connector.',
  keywords: ['Flare', 'FAssets', 'DeFi', 'Blockchain', 'XRP', 'Redemption', 'FLIP'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
