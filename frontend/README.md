# FLIP Protocol Frontend

Frontend demo application for the FLIP (Flare Liquidation Insurance Protocol).

## Features

- Wallet connection (MetaMask, WalletConnect via RainbowKit)
- Request redemption interface
- Real-time redemption status tracking
- Support for Flare Mainnet and Coston2 Testnet

## Setup

1. Install dependencies:
```bash
pnpm install
```

2. Update contract addresses in `lib/contracts.ts`:
   - All Coston2 addresses are already configured
   - Update FAsset address in redeem page if needed

3. Add full contract ABIs to `lib/contracts.ts` (currently using simplified ABI snippets)

4. Run development server:
```bash
pnpm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

## Configuration

The app is configured to work with:
- Flare Testnet (Coston2): Chain ID 114
- Flare Mainnet: Chain ID 14

Update `app/providers.tsx` to change network configuration.

## Notes

- Contract addresses need to be updated after deployment
- Full contract ABIs should be imported from `../artifacts/contracts/`
- For production, add error handling and loading states
- Consider adding a redemption history view






