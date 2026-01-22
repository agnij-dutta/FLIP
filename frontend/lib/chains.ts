import { defineChain } from 'viem';

// Coston2 testnet chain definition
export const coston2 = defineChain({
  id: 114,
  name: 'Coston2',
  nativeCurrency: {
    decimals: 18,
    name: 'C2FLR',
    symbol: 'C2FLR',
  },
  rpcUrls: {
    default: {
      http: ['https://coston2-api.flare.network/ext/C/rpc'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Coston2 Explorer',
      url: 'https://coston2-explorer.flare.network',
    },
  },
});

