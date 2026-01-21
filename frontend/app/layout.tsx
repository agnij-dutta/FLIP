import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import dynamic from 'next/dynamic';

// Dynamically import Providers with SSR disabled to prevent IndexedDB errors
const Providers = dynamic(() => import('./providers').then(mod => ({ default: mod.Providers })), {
  ssr: false,
});

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'FLIP Protocol - Flare Liquidation Insurance Protocol',
  description: 'Instant redemption insurance for FAssets on Flare Network',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen bg-[#0b0f1f] text-white antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}






