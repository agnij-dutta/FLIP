# Frontend Setup Instructions

## Quick Start

1. **Install dependencies:**
```bash
cd frontend
npm install
```

2. **Update contract addresses:**
   - Edit `app/page.tsx`
   - Set `FLIP_CORE_ADDRESS` to your deployed contract
   - Set `FASSET_ADDRESS` to the FAsset contract (e.g., FXRP)

3. **Run development server:**
```bash
npm run dev
```

4. **Open browser:**
   - Navigate to http://localhost:3000
   - Connect wallet (MetaMask, WalletConnect)
   - Switch to Coston2 testnet

## Features

- ✅ Wallet connection via RainbowKit
- ✅ Request redemption interface
- ✅ Real-time status tracking
- ✅ Support for Flare Mainnet and Coston2

## Configuration

The app supports:
- **Flare Testnet (Coston2):** Chain ID 114
- **Flare Mainnet:** Chain ID 14

To change networks, update `app/providers.tsx`.

## Development

- Framework: Next.js 14 (App Router)
- Styling: Tailwind CSS
- Web3: Wagmi + Viem + RainbowKit
- TypeScript: Full type safety

## Production Build

```bash
npm run build
npm start
```

## Notes

- Contract ABIs are simplified - import full ABIs from `../artifacts/contracts/` for production
- Add error boundaries and loading states
- Consider adding redemption history view
- Add transaction status notifications
