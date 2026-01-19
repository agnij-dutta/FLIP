'use client';

import { WagmiProvider, createConfig, http } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, getDefaultWallets } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { flare, flareTestnet } from 'wagmi/chains';
import { coston2 } from '@/lib/chains';

// Get connectors from RainbowKit
const { connectors } = getDefaultWallets({
  appName: 'FLIP Protocol',
  projectId: 'flip-protocol-demo',
  chains: [coston2, flareTestnet, flare],
});

// Create wagmi config manually to ensure proper connector setup
const config = createConfig({
  chains: [coston2, flareTestnet, flare],
  connectors,
  transports: {
    [coston2.id]: http(),
    [flareTestnet.id]: http(),
    [flare.id]: http(),
  },
  ssr: false,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}






