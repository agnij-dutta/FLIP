'use client';

import React, { useEffect, useState } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, getDefaultConfig } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { flare } from 'wagmi/chains';
import { coston2 } from '@/lib/chains';

// Create query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

// Create wagmi config using RainbowKit's getDefaultConfig (compatible with wagmi 2.9)
const wagmiConfig = getDefaultConfig({
  appName: 'FLIP Protocol',
  projectId: '1234567890abcdef1234567890abcdef', // WalletConnect project ID (placeholder)
  chains: [coston2, flare],
  ssr: false,
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Show loading state until mounted - don't render children without providers
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}






