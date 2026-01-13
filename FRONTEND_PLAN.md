# FLIP v2 - Frontend Plan

## Overview

Create a user-friendly, intuitive frontend for FLIP that makes instant FAsset redemptions accessible to everyone. The frontend should be **idiot-proof**, **easy to understand**, and **visually appealing**.

## Design Principles

1. **Simplicity First**: Minimal clicks, clear actions
2. **Transparency**: Show what's happening at each step
3. **Trust**: Display security guarantees and status
4. **Speed**: Show instant settlement when available
5. **Education**: Help users understand the process

## User Personas

### Primary: Regular User
- Wants to redeem FAssets quickly
- Doesn't understand technical details
- Needs clear, simple interface
- Wants to see status and progress

### Secondary: Liquidity Provider
- Wants to provide liquidity and earn fees
- Needs to see performance metrics
- Wants to manage positions easily

### Tertiary: Operator
- Needs to monitor oracle predictions
- Wants to see system health
- Needs to manage operations

## Screen Architecture

### 1. Landing Page (`/`)

**Purpose**: First impression, explain what FLIP does

**Components**:
- Hero section: "Instant FAsset Redemptions"
- Key benefits:
  - ⚡ Instant settlement (vs 3-5 min wait)
  - 🔒 Trust-minimized (FDC adjudication)
  - 💰 Capital efficient (no idle pools)
- "Get Started" button → Connect Wallet
- Simple diagram showing FLIP flow

**Design**:
- Clean, modern design
- Blue/purple gradient (Flare colors)
- Animated illustrations
- Mobile-responsive

---

### 2. Connect Wallet (`/connect`)

**Purpose**: Wallet connection and network selection

**Components**:
- Wallet connection buttons (MetaMask, WalletConnect, etc.)
- Network selector (Coston2, Songbird, Flare Mainnet)
- Network status indicator
- "Continue" button (disabled until connected)

**Design**:
- Large, clear buttons
- Network badges
- Connection status indicator

---

### 3. Dashboard (`/dashboard`)

**Purpose**: Main hub after wallet connection

**Components**:
- **Wallet Info Card**:
  - Address (shortened)
  - Network
  - Balance (FLR, FXRP, FBTC, etc.)
  
- **Quick Actions**:
  - "Redeem FAssets" button (primary CTA)
  - "Provide Liquidity" button (secondary)
  - "View Receipts" button (tertiary)

- **Recent Activity**:
  - List of recent redemptions
  - Status indicators
  - Quick links to details

**Design**:
- Card-based layout
- Clear hierarchy
- Action buttons prominent

---

### 4. Redeem FAssets (`/redeem`)

**Purpose**: Main redemption interface

**Components**:

#### Step 1: Select Asset & Amount
- **Asset Selector**:
  - Dropdown or tabs (FXRP, FBTC, FDOGE)
  - Asset icons
  - Current balance display
  
- **Amount Input**:
  - Number input with max button
  - Balance display: "Available: 1,000 FXRP"
  - Fiat value estimate (if available)
  
- **Preview Card**:
  - Estimated settlement time
  - Estimated haircut (if fast-lane)
  - "Continue" button

#### Step 2: Review & Confirm
- **Redemption Summary**:
  - Asset: FXRP
  - Amount: 1,000 FXRP
  - Estimated Settlement: Instant (fast-lane) or 3-5 min (FDC)
  - Estimated Haircut: 1% (if fast-lane)
  - Estimated Receive: 990 FXRP (if fast-lane)
  
- **Security Info**:
  - "🔒 Trust-minimized: FDC adjudication"
  - "⚡ Instant: Provisional settlement"
  - "💰 Safe: Escrow-backed"
  
- **Action Buttons**:
  - "Cancel" (secondary)
  - "Confirm Redemption" (primary, large)

#### Step 3: Processing
- **Status Indicator**:
  - Animated spinner
  - Status text: "Processing redemption..."
  - Progress steps:
    1. ✅ Request submitted
    2. ⏳ Oracle evaluating...
    3. ⏳ LP matching...
    4. ⏳ Creating escrow...
    5. ✅ Receipt minted!
  
- **Real-time Updates**:
  - WebSocket connection for live updates
  - Status changes reflected immediately

#### Step 4: Receipt & Options
- **Receipt Card**:
  - Receipt ID (NFT token ID)
  - Asset & Amount
  - Status: "Escrow Created"
  - Haircut: 1%
  
- **Action Options**:
  - **"Redeem Now"** button (if fast-lane):
    - Shows: "Receive 990 FXRP immediately (1% haircut)"
    - Instant settlement
  - **"Wait for FDC"** button:
    - Shows: "Receive 1,000 FXRP after FDC (no haircut)"
    - Wait 3-5 minutes
  
- **Status Tracker**:
  - Timeline showing:
    - ✅ Redemption requested
    - ✅ Escrow created
    - ⏳ Waiting for FDC...
    - ⏳ FDC attestation pending...
    - ✅ FDC confirmed (when done)

**Design**:
- Step-by-step wizard (clear progress)
- Large, clear buttons
- Status indicators with icons
- Real-time updates
- Mobile-friendly

---

### 5. Receipt Details (`/receipt/:id`)

**Purpose**: View and manage a specific receipt

**Components**:
- **Receipt Header**:
  - Receipt ID
  - Status badge (Escrow Created, Redeemed, Finalized, etc.)
  - Created timestamp
  
- **Redemption Details**:
  - Asset: FXRP
  - Amount: 1,000 FXRP
  - Haircut: 1%
  - LP: 0x1234... (if LP-funded)
  
- **Status Timeline**:
  - Visual timeline with checkpoints
  - Current step highlighted
  - Estimated time remaining
  
- **Actions**:
  - "Redeem Now" (if available)
  - "Wait for FDC" (if available)
  - "View on Explorer" (link to block explorer)
  
- **FDC Status** (if waiting):
  - FDC round ID
  - Attestation status
  - Estimated time: "~3 minutes remaining"

**Design**:
- Clean, focused layout
- Timeline visualization
- Clear action buttons

---

### 6. My Receipts (`/receipts`)

**Purpose**: List all user's receipts

**Components**:
- **Filter/Sort**:
  - Status filter (All, Pending, Redeemed, Finalized)
  - Asset filter
  - Sort by date, amount
  
- **Receipt List**:
  - Card for each receipt:
    - Asset icon
    - Amount
    - Status badge
    - Created date
    - Quick actions
  - Empty state: "No receipts yet"
  
- **Summary Stats**:
  - Total redemptions
  - Total value
  - Average settlement time

**Design**:
- Grid/list view toggle
- Card-based layout
- Filter sidebar

---

### 7. Provide Liquidity (`/liquidity`)

**Purpose**: LP onboarding and management

**Components**:

#### LP Dashboard
- **Position Summary**:
  - Total deposited
  - Available liquidity
  - Total earned (haircut fees)
  - APY estimate
  
- **Active Positions**:
  - List of positions per asset
  - Available amount
  - Min haircut
  - Max delay
  - Total earned

#### Deposit Liquidity
- **Asset Selector**: FXRP, FBTC, etc.
- **Amount Input**: How much to deposit
- **Parameters**:
  - **Min Haircut** slider:
    - Range: 0.1% - 5%
    - Explanation: "Lower = more matches, lower fees"
    - Recommended: 0.5-1%
  - **Max Delay** slider:
    - Range: 1 hour - 24 hours
    - Explanation: "How long you'll wait for FDC"
    - Recommended: 1-2 hours
  
- **Preview**:
  - Estimated matches per day
  - Estimated APY
  - Risk warning
  
- **Confirm & Deposit** button

#### Withdraw Liquidity
- Select position
- Enter amount
- Confirm withdrawal

**Design**:
- Clear parameter sliders
- Real-time APY calculation
- Risk warnings
- Performance charts

---

### 8. LP Analytics (`/liquidity/analytics`)

**Purpose**: LP performance metrics

**Components**:
- **Performance Metrics**:
  - Total earnings (chart)
  - Match rate
  - Average haircut
  - APY over time
  
- **Position Details**:
  - Per-asset breakdown
  - Match history
  - Fee earnings
  
- **Recommendations**:
  - Optimal haircut suggestions
  - Market conditions
  - Risk alerts

**Design**:
- Charts and graphs
- Data tables
- Insights section

---

### 9. System Status (`/status`)

**Purpose**: System health and transparency

**Components**:
- **System Health**:
  - Oracle nodes status
  - Contract status
  - FDC status
  
- **Statistics**:
  - Total redemptions
  - Fast-lane success rate
  - Average settlement time
  - Total LP liquidity
  
- **Security**:
  - Mathematical guarantees
  - Audit status
  - Bug bounty info

**Design**:
- Status indicators (green/yellow/red)
- Statistics cards
- Trust badges

---

## Technical Architecture

### Frontend Stack

**Recommended**:
- **Framework**: Next.js 14 (React)
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: Zustand or React Query
- **Web3**: wagmi + viem
- **Charts**: Recharts or Chart.js
- **Animations**: Framer Motion

**Alternative**:
- **Framework**: Vite + React
- **Styling**: Material-UI or Chakra UI
- **State Management**: Redux Toolkit
- **Web3**: ethers.js or web3.js

### Key Libraries

1. **Web3 Integration**:
   - `wagmi`: React hooks for Ethereum
   - `viem`: TypeScript Ethereum library
   - `@tanstack/react-query`: Data fetching

2. **UI Components**:
   - `shadcn/ui`: High-quality components
   - `lucide-react`: Icons
   - `framer-motion`: Animations

3. **Utilities**:
   - `date-fns`: Date formatting
   - `big.js`: Big number handling
   - `zod`: Schema validation

### Contract Integration

**ABI Loading**:
```typescript
import FLIPCoreABI from './abis/FLIPCore.json'
import EscrowVaultABI from './abis/EscrowVault.json'
import SettlementReceiptABI from './abis/SettlementReceipt.json'
import LiquidityProviderRegistryABI from './abis/LiquidityProviderRegistry.json'
```

**Contract Addresses**:
```typescript
const CONTRACTS = {
  coston2: {
    FLIPCore: '0xcBc8eB46172c2caD5b4961E8c4F5f827e618a387',
    EscrowVault: '0x0e37cc3dc8fa1675f2748b77dddff452b63dd4cc',
    SettlementReceipt: '0x0Ff7d4E7aF64059426F76d2236155ef1655C99D8',
    LiquidityProviderRegistry: '0x2CC077f1Da27e7e08A1832804B03b30A2990a61C',
  }
}
```

**Event Listening**:
```typescript
// Listen for RedemptionRequested events
const { data: events } = useContractEvent({
  address: FLIP_CORE_ADDRESS,
  abi: FLIPCoreABI,
  eventName: 'RedemptionRequested',
  listener: (event) => {
    // Update UI
  }
})
```

### Real-Time Updates

**WebSocket Connection**:
- Connect to custom WebSocket server
- Listen for redemption status updates
- Update UI in real-time

**Polling Fallback**:
- Poll contract state every 5 seconds
- Update UI when state changes

## User Experience Flow

### Happy Path: Fast-Lane Redemption

1. User lands on `/`
2. Clicks "Get Started" → `/connect`
3. Connects wallet → `/dashboard`
4. Clicks "Redeem FAssets" → `/redeem`
5. Selects FXRP, enters 1,000 → Step 1
6. Reviews summary → Step 2
7. Confirms → Step 3 (Processing)
8. Receives receipt → Step 4
9. Clicks "Redeem Now" → Instant settlement ✅
10. Redirected to `/receipt/:id` → See finalized status

**Time**: ~30 seconds total

### Alternative Path: FDC Wait

1-7. Same as above
8. Receives receipt → Step 4
9. Clicks "Wait for FDC" → Step 4 (Waiting)
10. Status updates: "FDC attestation pending..."
11. After 3-5 min: Status updates: "FDC confirmed ✅"
12. Funds automatically released

**Time**: ~3-5 minutes total

## Design System

### Colors

**Primary**:
- Blue: `#0066FF` (Flare blue)
- Purple: `#7B2CBF` (Flare purple)
- Gradient: Blue → Purple

**Status**:
- Success: `#10B981` (green)
- Warning: `#F59E0B` (yellow)
- Error: `#EF4444` (red)
- Info: `#3B82F6` (blue)

**Neutral**:
- Background: `#F9FAFB` (light gray)
- Card: `#FFFFFF` (white)
- Text: `#111827` (dark gray)
- Border: `#E5E7EB` (light gray)

### Typography

- **Headings**: Inter, bold
- **Body**: Inter, regular
- **Monospace**: JetBrains Mono (for addresses)

### Spacing

- Base unit: 4px
- Common: 8px, 16px, 24px, 32px, 48px

### Components

1. **Button**:
   - Primary: Blue gradient, white text
   - Secondary: White, blue border
   - Tertiary: Gray, minimal

2. **Card**:
   - White background
   - Rounded corners (8px)
   - Shadow: subtle

3. **Status Badge**:
   - Colored dot + text
   - Rounded pill shape

4. **Progress Indicator**:
   - Step-by-step wizard
   - Checkmarks for completed
   - Spinner for in-progress

## Mobile Responsiveness

- **Mobile First**: Design for mobile, enhance for desktop
- **Breakpoints**:
  - Mobile: < 640px
  - Tablet: 640px - 1024px
  - Desktop: > 1024px

- **Mobile Optimizations**:
  - Bottom navigation bar
  - Swipeable cards
  - Simplified layouts
  - Touch-friendly buttons (min 44px)

## Accessibility

- **WCAG 2.1 AA Compliance**:
  - Color contrast ratios
  - Keyboard navigation
  - Screen reader support
  - Focus indicators

- **Features**:
  - ARIA labels
  - Semantic HTML
  - Alt text for images
  - Skip links

## Performance

- **Target Metrics**:
  - First Contentful Paint: < 1.5s
  - Time to Interactive: < 3s
  - Lighthouse Score: > 90

- **Optimizations**:
  - Code splitting
  - Lazy loading
  - Image optimization
  - Caching strategies

## Security

- **Best Practices**:
  - Input validation
  - XSS prevention
  - CSRF protection
  - Secure WebSocket (WSS)
  - Rate limiting

## Testing Plan

### Unit Tests
- Component rendering
- User interactions
- State management

### Integration Tests
- Wallet connection
- Contract interactions
- Event handling

### E2E Tests
- Full redemption flow
- LP deposit flow
- Error handling

## Deployment

### Infrastructure
- **Hosting**: Vercel or Netlify
- **CDN**: Cloudflare
- **Domain**: `flip.flare.network` (or similar)

### CI/CD
- GitHub Actions
- Automated testing
- Preview deployments
- Production deployments

## Timeline

### Phase 1: Core Screens (2-3 weeks)
- Landing page
- Connect wallet
- Dashboard
- Redeem flow

### Phase 2: Receipt Management (1-2 weeks)
- Receipt details
- Receipt list
- Status tracking

### Phase 3: LP Features (2-3 weeks)
- Provide liquidity
- LP dashboard
- Analytics

### Phase 4: Polish & Testing (1-2 weeks)
- Design refinement
- Performance optimization
- Testing
- Bug fixes

**Total**: 6-10 weeks

## Success Metrics

- **User Adoption**:
  - Daily active users
  - Redemptions per day
  - LP deposits

- **User Experience**:
  - Time to complete redemption
  - Error rate
  - User satisfaction

- **Technical**:
  - Page load time
  - Error rate
  - Uptime

---

**Last Updated**: $(date)
**Status**: 📋 Plan (Ready for Validation)
**Next Step**: Get validation, then design components

