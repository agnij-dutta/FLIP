'use client';

import React, { useEffect, useState } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, getDefaultConfig, darkTheme, lightTheme } from '@rainbow-me/rainbowkit';
import { ThemeProvider, useTheme } from 'next-themes';
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

// Custom RainbowKit theme
const customLightTheme = lightTheme({
  accentColor: '#E31D65',
  accentColorForeground: 'white',
  borderRadius: 'large',
  fontStack: 'system',
});

const customDarkTheme = darkTheme({
  accentColor: '#E31D65',
  accentColorForeground: 'white',
  borderRadius: 'large',
  fontStack: 'system',
});

function RainbowKitProviderWrapper({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();

  return (
    <RainbowKitProvider theme={resolvedTheme === 'dark' ? customDarkTheme : customLightTheme}>
      {children}
    </RainbowKitProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Show loading state until mounted - don't render children without providers
  if (!mounted) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          {/* Animated logo */}
          <div className="relative">
            <div className="absolute inset-0 bg-flare-pink/30 blur-2xl rounded-full animate-pulse" />
            <svg
              width="48"
              height="48"
              viewBox="0 0 40 40"
              fill="none"
              className="relative animate-pulse"
            >
              <path
                d="M20 4L4 12V28L20 36L36 28V12L20 4Z"
                fill="#E31D65"
              />
              <path
                d="M20 4L4 12L20 20L36 12L20 4Z"
                fill="#FF4081"
              />
              <path
                d="M12 16L20 20V28L12 24V16Z"
                fill="white"
                fillOpacity="0.4"
              />
            </svg>
          </div>
          <div className="text-gray-500 dark:text-gray-400 font-medium">Loading FLIP Protocol...</div>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProviderWrapper>{children}</RainbowKitProviderWrapper>
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  );
}
