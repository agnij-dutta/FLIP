# FLIP v2 - Frontend Component Breakdown

## Overview

This document breaks down all low-level components needed for the **scoped grant/demo version** of the FLIP frontend. Components are organized by category and complexity.

**Scope**: Landing, Connect Wallet, Redeem Flow, Receipt Detail, System Status (5 screens total)

---

## Component Categories

1. **Atomic Components** (Basic building blocks)
2. **Form Components** (Inputs, selectors, buttons)
3. **Status Components** (Indicators, badges, timelines)
4. **Card Components** (Containers, summaries)
5. **Layout Components** (Structure, navigation)
6. **Data Display Components** (Tables, lists, charts)
7. **Page Components** (Screen-level compositions)

---

## 1. Atomic Components

### 1.1 Button
**File**: `components/ui/Button.tsx`

**Variants**:
- `primary`: Blue gradient, white text, large (for main CTAs)
- `secondary`: White background, blue border, medium
- `tertiary`: Gray background, minimal, small
- `danger`: Red background (for destructive actions)
- `ghost`: Transparent, text only

**Props**:
```typescript
{
  variant: 'primary' | 'secondary' | 'tertiary' | 'danger' | 'ghost'
  size: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  fullWidth?: boolean
  onClick: () => void
  children: React.ReactNode
}
```

**States**: Default, Hover, Active, Disabled, Loading

**Use Cases**:
- "Redeem FAssets" (primary, lg)
- "Confirm Redemption" (primary, lg)
- "Cancel" (secondary, md)
- "Redeem Now" (primary, lg)
- "Wait for FDC" (secondary, lg)

---

### 1.2 Badge
**File**: `components/ui/Badge.tsx`

**Variants**:
- `success`: Green (Finalized, Redeemed)
- `warning`: Yellow (Pending, Waiting)
- `error`: Red (Failed, Timeout)
- `info`: Blue (Escrow Created, Processing)

**Props**:
```typescript
{
  variant: 'success' | 'warning' | 'error' | 'info'
  children: string
  icon?: React.ReactNode
}
```

**Use Cases**:
- Redemption status badges
- Network badges
- Asset badges

---

### 1.3 Icon
**File**: `components/ui/Icon.tsx`

**Icons Needed**:
- `CheckCircle` (success states)
- `Clock` (pending/waiting)
- `XCircle` (error/failed)
- `Info` (information)
- `Wallet` (wallet connection)
- `ArrowRight` (navigation)
- `Copy` (copy address)
- `ExternalLink` (explorer links)
- `Refresh` (refresh status)

**Library**: `lucide-react`

---

### 1.4 Spinner
**File**: `components/ui/Spinner.tsx`

**Variants**:
- `sm`, `md`, `lg` sizes
- `primary` (blue), `white` colors

**Use Cases**:
- Loading states
- Processing indicators
- Button loading states

---

### 1.5 Tooltip
**File**: `components/ui/Tooltip.tsx`

**Props**:
```typescript
{
  content: string
  children: React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
}
```

**Use Cases**:
- Explain haircut
- Explain FDC delay
- Explain escrow

---

## 2. Form Components

### 2.1 Input
**File**: `components/forms/Input.tsx`

**Variants**:
- `text`: Standard text input
- `number`: Number input with validation
- `address`: Address input with validation

**Props**:
```typescript
{
  label?: string
  placeholder?: string
  value: string
  onChange: (value: string) => void
  error?: string
  helperText?: string
  disabled?: boolean
  max?: string | number
  suffix?: React.ReactNode (e.g., "FXRP")
  prefix?: React.ReactNode
}
```

**Use Cases**:
- Amount input (with max button)
- Address input (for LP address display)

---

### 2.2 Select
**File**: `components/forms/Select.tsx`

**Props**:
```typescript
{
  label?: string
  options: Array<{ value: string, label: string, icon?: React.ReactNode }>
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}
```

**Use Cases**:
- Asset selector (FXRP, FBTC, FDOGE)
- Network selector (Coston2, Songbird, Mainnet)

---

### 2.3 Slider
**File**: `components/forms/Slider.tsx`

**Props**:
```typescript
{
  label: string
  min: number
  max: number
  step?: number
  value: number
  onChange: (value: number) => void
  formatValue?: (value: number) => string
  helperText?: string
}
```

**Use Cases**:
- Min haircut selector (for LP - Phase 2)
- Max delay selector (for LP - Phase 2)

---

### 2.4 Checkbox
**File**: `components/forms/Checkbox.tsx`

**Props**:
```typescript
{
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}
```

**Use Cases**:
- Terms acceptance
- Confirmation checkboxes

---

## 3. Status Components

### 3.1 StatusBadge
**File**: `components/status/StatusBadge.tsx`

**Props**:
```typescript
{
  status: 'pending' | 'processing' | 'escrow-created' | 'redeemed' | 'finalized' | 'failed' | 'timeout'
  showIcon?: boolean
}
```

**Mapping**:
- `pending` → Info badge (blue)
- `processing` → Warning badge (yellow, spinner)
- `escrow-created` → Info badge (blue)
- `redeemed` → Success badge (green)
- `finalized` → Success badge (green)
- `failed` → Error badge (red)
- `timeout` → Error badge (red)

---

### 3.2 ProgressSteps
**File**: `components/status/ProgressSteps.tsx`

**Props**:
```typescript
{
  steps: Array<{
    id: string
    label: string
    status: 'completed' | 'active' | 'pending'
    timestamp?: Date
  }>
  orientation?: 'horizontal' | 'vertical'
}
```

**Use Cases**:
- Redemption processing steps
- Receipt status timeline

**Steps**:
1. Request submitted
2. Oracle evaluating
3. LP matching
4. Escrow created
5. Receipt minted
6. (Optional) FDC attestation
7. (Optional) Finalized

---

### 3.3 StatusTimeline
**File**: `components/status/StatusTimeline.tsx`

**Props**:
```typescript
{
  events: Array<{
    label: string
    status: 'completed' | 'active' | 'pending'
    timestamp: Date
    description?: string
  }>
}
```

**Use Cases**:
- Receipt detail page timeline
- Shows redemption → escrow → FDC → finalized

---

### 3.4 FDCStatus
**File**: `components/status/FDCStatus.tsx`

**Props**:
```typescript
{
  status: 'waiting' | 'attesting' | 'confirmed' | 'failed' | 'timeout'
  roundId?: number
  estimatedTime?: number // seconds remaining
}
```

**Display**:
- Status badge
- Round ID (if available)
- Countdown timer (if waiting)
- "FDC is the final judge" message

---

## 4. Card Components

### 4.1 Card
**File**: `components/cards/Card.tsx`

**Base container component**

**Props**:
```typescript
{
  title?: string
  subtitle?: string
  children: React.ReactNode
  variant?: 'default' | 'outlined' | 'elevated'
  padding?: 'sm' | 'md' | 'lg'
}
```

---

### 4.2 WalletInfoCard
**File**: `components/cards/WalletInfoCard.tsx`

**Props**:
```typescript
{
  address: string
  network: string
  balances: Array<{
    asset: string
    amount: string
    symbol: string
  }>
}
```

**Displays**:
- Shortened address with copy button
- Network badge
- Asset balances (FLR, FXRP, FBTC)

---

### 4.3 RedemptionSummaryCard
**File**: `components/cards/RedemptionSummaryCard.tsx`

**Props**:
```typescript
{
  asset: string
  amount: string
  estimatedSettlement: 'instant' | 'fdc-wait'
  estimatedHaircut?: number // percentage
  estimatedReceive?: string
}
```

**Displays**:
- Asset icon + name
- Amount
- Settlement time estimate
- Haircut (if fast-lane)
- Receive amount

---

### 4.4 SecurityInfoCard
**File**: `components/cards/SecurityInfoCard.tsx`

**Fixed content card showing**:
- 🔒 "FDC is the final judge. FLIP only changes when users get paid."
- ⚡ "Instant: Provisional settlement"
- 💰 "Safe: Escrow-backed"

**Always visible on redeem confirmation**

---

### 4.5 ReceiptCard
**File**: `components/cards/ReceiptCard.tsx`

**Props**:
```typescript
{
  receiptId: string
  asset: string
  amount: string
  status: string
  haircut?: number
  lpAddress?: string
  createdAt: Date
  onClick?: () => void
}
```

**Displays**:
- Receipt ID (NFT token ID)
- Asset + amount
- Status badge
- Haircut (if applicable)
- Created timestamp
- Clickable to navigate to detail

---

### 4.6 SystemHealthCard
**File**: `components/cards/SystemHealthCard.tsx`

**Props**:
```typescript
{
  title: string
  status: 'healthy' | 'warning' | 'error'
  value: string | number
  description?: string
  icon?: React.ReactNode
}
```

**Use Cases**:
- Oracle nodes status
- Contract status
- FDC status
- Total redemptions
- Success rate

---

## 5. Layout Components

### 5.1 Header
**File**: `components/layout/Header.tsx`

**Components**:
- Logo
- Navigation (if needed)
- Wallet connection button/status
- Network selector

---

### 5.2 Footer
**File**: `components/layout/Footer.tsx`

**Content**:
- Links (Docs, Status, Explorer)
- "FDC is the final judge" message
- Version info

---

### 5.3 Container
**File**: `components/layout/Container.tsx`

**Props**:
```typescript
{
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  padding?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
}
```

**Responsive container with max-width**

---

### 5.4 PageLayout
**File**: `components/layout/PageLayout.tsx`

**Structure**:
- Header
- Main content (with Container)
- Footer

---

### 5.5 StepWizard
**File**: `components/layout/StepWizard.tsx`

**Props**:
```typescript
{
  steps: Array<{ id: string, label: string }>
  currentStep: number
  children: React.ReactNode
}
```

**Use Cases**:
- Redeem flow (4 steps)
- Shows progress indicator at top

---

## 6. Data Display Components

### 6.1 AddressDisplay
**File**: `components/data/AddressDisplay.tsx`

**Props**:
```typescript
{
  address: string
  short?: boolean // Show shortened version
  showCopy?: boolean
  showExplorer?: boolean
  network?: string
}
```

**Displays**:
- Address (shortened: `0x1234...5678`)
- Copy button
- Explorer link

---

### 6.2 AmountDisplay
**File**: `components/data/AmountDisplay.tsx`

**Props**:
```typescript
{
  amount: string | bigint
  decimals?: number
  symbol: string
  showFiat?: boolean
  fiatValue?: number
}
```

**Formats**:
- Large numbers with commas
- Decimals (e.g., "1,000.50 FXRP")
- Optional fiat conversion

---

### 6.3 ReceiptList
**File**: `components/data/ReceiptList.tsx`

**Props**:
```typescript
{
  receipts: Array<ReceiptCardProps>
  emptyMessage?: string
  onReceiptClick?: (receiptId: string) => void
}
```

**Displays**:
- Grid/list of ReceiptCard components
- Empty state if no receipts

---

### 6.4 StatCard
**File**: `components/data/StatCard.tsx`

**Props**:
```typescript
{
  label: string
  value: string | number
  change?: number // percentage change
  icon?: React.ReactNode
  description?: string
}
```

**Use Cases**:
- Total redemptions
- Success rate
- Average settlement time
- Total LP liquidity

---

## 7. Web3 Components

### 7.1 WalletConnectButton
**File**: `components/web3/WalletConnectButton.tsx`

**Props**:
```typescript
{
  onConnect?: () => void
  onDisconnect?: () => void
}
```

**States**:
- Not connected: "Connect Wallet" button
- Connecting: Spinner
- Connected: Address display + disconnect

**Integrates with**: `wagmi` useConnect, useDisconnect

---

### 7.2 NetworkSelector
**File**: `components/web3/NetworkSelector.tsx`

**Props**:
```typescript
{
  networks: Array<{ id: number, name: string, rpc: string }>
  currentNetwork: number
  onNetworkChange: (networkId: number) => void
}
```

**Networks**:
- Coston2 (114)
- Songbird (19)
- Flare Mainnet (14)

---

### 7.3 TransactionStatus
**File**: `components/web3/TransactionStatus.tsx`

**Props**:
```typescript
{
  hash?: string
  status: 'pending' | 'success' | 'error'
  onClose?: () => void
}
```

**Displays**:
- Transaction hash
- Status (pending spinner, success check, error X)
- Explorer link
- Auto-dismiss on success

---

## 8. Page Components

### 8.1 LandingPage
**File**: `pages/index.tsx`

**Composition**:
- Hero section (1 diagram + 1 sentence)
- Key benefits (3 cards)
- "Get Started" button
- Footer with "FDC is the final judge" message

**Components Used**:
- Container
- Card
- Button
- Header
- Footer

---

### 8.2 ConnectWalletPage
**File**: `pages/connect.tsx`

**Composition**:
- Title: "Connect Your Wallet"
- WalletConnectButton (MetaMask, WalletConnect, etc.)
- NetworkSelector
- "Continue" button (disabled until connected)

**Components Used**:
- Container
- WalletConnectButton
- NetworkSelector
- Button
- Header

---

### 8.3 RedeemPage
**File**: `pages/redeem.tsx`

**Composition**:
- StepWizard (4 steps)
- Step 1: AssetSelector + AmountInput + PreviewCard
- Step 2: RedemptionSummaryCard + SecurityInfoCard + Confirm button
- Step 3: ProgressSteps + Spinner
- Step 4: ReceiptCard + Action buttons (Redeem Now / Wait for FDC) + StatusTimeline

**Components Used**:
- StepWizard
- Select
- Input
- RedemptionSummaryCard
- SecurityInfoCard
- ProgressSteps
- ReceiptCard
- Button
- StatusTimeline

---

### 8.4 ReceiptDetailPage
**File**: `pages/receipt/[id].tsx`

**Composition**:
- Receipt header (ID, status, timestamp)
- Redemption details (asset, amount, haircut, LP)
- StatusTimeline (vertical)
- FDCStatus component
- Action buttons (Redeem Now / Wait for FDC)
- Explorer link

**Components Used**:
- StatusBadge
- StatusTimeline
- FDCStatus
- AddressDisplay
- AmountDisplay
- Button
- Card

---

### 8.5 SystemStatusPage
**File**: `pages/status.tsx`

**Composition**:
- Title: "FLIP System Status"
- SystemHealthCard grid (Oracle, Contracts, FDC)
- Statistics grid (Total redemptions, Success rate, Avg time, LP liquidity)
- "FDC is the final judge" message

**Components Used**:
- SystemHealthCard
- StatCard
- Card
- Container

---

## 9. Shared Components

### 9.1 LoadingState
**File**: `components/shared/LoadingState.tsx`

**Props**:
```typescript
{
  message?: string
  size?: 'sm' | 'md' | 'lg'
}
```

**Use Cases**:
- Page loading
- Data fetching
- Transaction pending

---

### 9.2 ErrorState
**File**: `components/shared/ErrorState.tsx`

**Props**:
```typescript
{
  title: string
  message: string
  action?: { label: string, onClick: () => void }
}
```

**Use Cases**:
- Transaction errors
- Network errors
- Contract errors

---

### 9.3 EmptyState
**File**: `components/shared/EmptyState.tsx`

**Props**:
```typescript
{
  icon?: React.ReactNode
  title: string
  description?: string
  action?: { label: string, onClick: () => void }
}
```

**Use Cases**:
- No receipts
- No LP positions
- No redemptions

---

### 9.4 FDCBanner
**File**: `components/shared/FDCBanner.tsx`

**Fixed message component**:
- "🔒 FDC is the final judge. FLIP only changes when users get paid."

**Variants**:
- `inline`: Small text in forms
- `banner`: Full-width banner at top
- `card`: Card format

**Always visible on**:
- Landing page (footer)
- Redeem confirmation (card)
- Receipt detail (inline)

---

### 9.5 CopyButton
**File**: `components/shared/CopyButton.tsx`

**Props**:
```typescript
{
  value: string
  label?: string
}
```

**Displays**:
- Copy icon button
- Shows "Copied!" toast on click

---

### 9.6 ExplorerLink
**File**: `components/shared/ExplorerLink.tsx`

**Props**:
```typescript
{
  type: 'address' | 'transaction' | 'token'
  value: string
  network: string
  children?: React.ReactNode
}
```

**Generates**:
- Coston2: `https://coston2-explorer.flare.network/address/...`
- Songbird: `https://songbird-explorer.flare.network/address/...`
- Mainnet: `https://flare-explorer.flare.network/address/...`

---

## 10. Hook Components (React Hooks)

### 10.1 useWallet
**File**: `hooks/useWallet.ts`

**Returns**:
```typescript
{
  address: string | undefined
  isConnected: boolean
  network: number | undefined
  connect: () => void
  disconnect: () => void
  switchNetwork: (networkId: number) => void
}
```

**Uses**: `wagmi` hooks

---

### 10.2 useRedemption
**File**: `hooks/useRedemption.ts`

**Returns**:
```typescript
{
  requestRedemption: (asset: string, amount: bigint) => Promise<string>
  getRedemptionStatus: (id: number) => Promise<RedemptionStatus>
  subscribeToRedemption: (id: number, callback: (status) => void) => void
}
```

**Uses**: FLIPCore contract

---

### 10.3 useReceipt
**File**: `hooks/useReceipt.ts`

**Returns**:
```typescript
{
  getReceipt: (tokenId: number) => Promise<Receipt>
  redeemNow: (tokenId: number) => Promise<void>
  redeemAfterFDC: (tokenId: number) => Promise<void>
  subscribeToReceipt: (tokenId: number, callback: (receipt) => void) => void
}
```

**Uses**: SettlementReceipt contract

---

### 10.4 useSystemStatus
**File**: `hooks/useSystemStatus.ts`

**Returns**:
```typescript
{
  oracleStatus: 'healthy' | 'warning' | 'error'
  contractStatus: 'healthy' | 'warning' | 'error'
  fdcStatus: 'healthy' | 'warning' | 'error'
  totalRedemptions: number
  successRate: number
  averageSettlementTime: number
  totalLPLiquidity: bigint
}
```

**Uses**: Multiple contract reads

---

## 11. Utility Components

### 11.1 Toast
**File**: `components/ui/Toast.tsx`

**Props**:
```typescript
{
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
  duration?: number
}
```

**Use Cases**:
- Transaction success
- Transaction error
- Copy to clipboard
- Network switch

---

### 11.2 Modal
**File**: `components/ui/Modal.tsx`

**Props**:
```typescript
{
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}
```

**Use Cases**:
- Confirmation dialogs
- Error messages
- Transaction details

---

### 11.3 Skeleton
**File**: `components/ui/Skeleton.tsx`

**Props**:
```typescript
{
  width?: string | number
  height?: string | number
  variant?: 'text' | 'circular' | 'rectangular'
}
```

**Use Cases**:
- Loading placeholders
- Data fetching states

---

## Component Dependency Tree

```
Page Components
├── Layout Components
│   ├── Header
│   ├── Footer
│   ├── Container
│   └── StepWizard
├── Card Components
│   ├── Card (base)
│   ├── WalletInfoCard
│   ├── RedemptionSummaryCard
│   ├── SecurityInfoCard
│   ├── ReceiptCard
│   └── SystemHealthCard
├── Form Components
│   ├── Input
│   ├── Select
│   └── Button
├── Status Components
│   ├── StatusBadge
│   ├── ProgressSteps
│   ├── StatusTimeline
│   └── FDCStatus
├── Data Display
│   ├── AddressDisplay
│   ├── AmountDisplay
│   └── StatCard
├── Web3 Components
│   ├── WalletConnectButton
│   ├── NetworkSelector
│   └── TransactionStatus
└── Shared Components
    ├── FDCBanner
    ├── LoadingState
    ├── ErrorState
    └── EmptyState
```

## Component Count Summary

| Category | Count | Files |
|----------|-------|-------|
| **Atomic** | 5 | Button, Badge, Icon, Spinner, Tooltip |
| **Form** | 4 | Input, Select, Slider, Checkbox |
| **Status** | 4 | StatusBadge, ProgressSteps, StatusTimeline, FDCStatus |
| **Card** | 6 | Card, WalletInfoCard, RedemptionSummaryCard, SecurityInfoCard, ReceiptCard, SystemHealthCard |
| **Layout** | 5 | Header, Footer, Container, PageLayout, StepWizard |
| **Data Display** | 4 | AddressDisplay, AmountDisplay, ReceiptList, StatCard |
| **Web3** | 3 | WalletConnectButton, NetworkSelector, TransactionStatus |
| **Page** | 5 | Landing, Connect, Redeem, ReceiptDetail, Status |
| **Shared** | 6 | LoadingState, ErrorState, EmptyState, FDCBanner, CopyButton, ExplorerLink |
| **UI Utilities** | 3 | Toast, Modal, Skeleton |
| **Hooks** | 4 | useWallet, useRedemption, useReceipt, useSystemStatus |
| **TOTAL** | **49 components** | |

## Implementation Priority

### Phase 1: Core (Week 1-2)
1. Atomic components (Button, Badge, Icon, Spinner)
2. Form components (Input, Select, Button)
3. Layout components (Header, Footer, Container, PageLayout)
4. Web3 components (WalletConnectButton, NetworkSelector)
5. Shared components (LoadingState, ErrorState, FDCBanner)

### Phase 2: Status & Cards (Week 2-3)
1. Status components (StatusBadge, ProgressSteps, StatusTimeline, FDCStatus)
2. Card components (Card, WalletInfoCard, RedemptionSummaryCard, SecurityInfoCard, ReceiptCard)
3. Data display (AddressDisplay, AmountDisplay)

### Phase 3: Pages (Week 3-4)
1. Landing page
2. Connect wallet page
3. Redeem page (with StepWizard)
4. Receipt detail page
5. System status page

### Phase 4: Polish (Week 4-5)
1. Remaining utilities (Toast, Modal, Skeleton)
2. Hooks (useWallet, useRedemption, useReceipt, useSystemStatus)
3. Error handling
4. Responsive design
5. Testing

---

## Key Design Decisions

### 1. FDC Messaging
- **FDCBanner** component appears on:
  - Landing page footer
  - Redeem confirmation (SecurityInfoCard)
  - Receipt detail page (inline)
- **Message**: "🔒 FDC is the final judge. FLIP only changes when users get paid."

### 2. Status Clarity
- **StatusTimeline** shows exact flow: Request → Oracle → LP → Escrow → FDC → Finalized
- **FDCStatus** component always visible when waiting for FDC
- **ProgressSteps** shows real-time progress during redemption

### 3. Receipt as Hero
- **ReceiptCard** is the primary UI element
- **ReceiptDetailPage** is the most important screen
- Timeline visualization makes process transparent

### 4. Minimal LP UI (Phase 2)
- LP features removed from v1 scope
- Only show LP info in receipt (if LP-funded)
- No LP dashboard or analytics in v1

---

## Component File Structure

```
frontend/
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Badge.tsx
│   │   ├── Icon.tsx
│   │   ├── Spinner.tsx
│   │   ├── Tooltip.tsx
│   │   ├── Toast.tsx
│   │   ├── Modal.tsx
│   │   └── Skeleton.tsx
│   ├── forms/
│   │   ├── Input.tsx
│   │   ├── Select.tsx
│   │   ├── Slider.tsx
│   │   └── Checkbox.tsx
│   ├── status/
│   │   ├── StatusBadge.tsx
│   │   ├── ProgressSteps.tsx
│   │   ├── StatusTimeline.tsx
│   │   └── FDCStatus.tsx
│   ├── cards/
│   │   ├── Card.tsx
│   │   ├── WalletInfoCard.tsx
│   │   ├── RedemptionSummaryCard.tsx
│   │   ├── SecurityInfoCard.tsx
│   │   ├── ReceiptCard.tsx
│   │   └── SystemHealthCard.tsx
│   ├── layout/
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   ├── Container.tsx
│   │   ├── PageLayout.tsx
│   │   └── StepWizard.tsx
│   ├── data/
│   │   ├── AddressDisplay.tsx
│   │   ├── AmountDisplay.tsx
│   │   ├── ReceiptList.tsx
│   │   └── StatCard.tsx
│   ├── web3/
│   │   ├── WalletConnectButton.tsx
│   │   ├── NetworkSelector.tsx
│   │   └── TransactionStatus.tsx
│   └── shared/
│       ├── LoadingState.tsx
│       ├── ErrorState.tsx
│       ├── EmptyState.tsx
│       ├── FDCBanner.tsx
│       ├── CopyButton.tsx
│       └── ExplorerLink.tsx
├── pages/
│   ├── index.tsx (Landing)
│   ├── connect.tsx
│   ├── redeem.tsx
│   ├── receipt/
│   │   └── [id].tsx
│   └── status.tsx
├── hooks/
│   ├── useWallet.ts
│   ├── useRedemption.ts
│   ├── useReceipt.ts
│   └── useSystemStatus.ts
└── lib/
    ├── contracts.ts (addresses, ABIs)
    ├── utils.ts (formatting, validation)
    └── constants.ts
```

---

## Component Specifications

### Critical Components (Must Get Right)

#### 1. ReceiptCard
- **Why**: Primary UI element, most visible
- **Key Features**:
  - Clear status badge
  - Asset + amount prominent
  - Action buttons (Redeem Now / Wait for FDC)
  - Clickable to detail page

#### 2. StatusTimeline
- **Why**: Makes FDC visible and understandable
- **Key Features**:
  - Visual timeline with checkpoints
  - Current step highlighted
  - FDC status always visible
  - Estimated time remaining

#### 3. SecurityInfoCard
- **Why**: Addresses trust concerns
- **Key Features**:
  - "FDC is the final judge" message
  - Trust indicators
  - Always visible on confirmation

#### 4. FDCStatus
- **Why**: Makes FDC visible (Flare requirement)
- **Key Features**:
  - Status badge
  - Round ID display
  - Countdown timer
  - "FDC is the final judge" message

---

## Design Tokens

### Colors
```typescript
const colors = {
  primary: {
    blue: '#0066FF',
    purple: '#7B2CBF',
    gradient: 'linear-gradient(135deg, #0066FF 0%, #7B2CBF 100%)'
  },
  status: {
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6'
  },
  neutral: {
    background: '#F9FAFB',
    card: '#FFFFFF',
    text: '#111827',
    border: '#E5E7EB'
  }
}
```

### Typography
```typescript
const typography = {
  fontFamily: {
    heading: 'Inter, sans-serif',
    body: 'Inter, sans-serif',
    mono: 'JetBrains Mono, monospace'
  },
  sizes: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem'
  }
}
```

### Spacing
```typescript
const spacing = {
  xs: '0.25rem',  // 4px
  sm: '0.5rem',   // 8px
  md: '1rem',     // 16px
  lg: '1.5rem',  // 24px
  xl: '2rem',     // 32px
  '2xl': '3rem'   // 48px
}
```

---

## Component Testing Requirements

### Unit Tests
- Button variants and states
- Input validation
- Status badge mappings
- Amount formatting
- Address shortening

### Integration Tests
- Wallet connection flow
- Redemption flow (all steps)
- Receipt redemption (both paths)
- Network switching

### Visual Tests
- Component rendering
- Responsive breakpoints
- Dark mode (if implemented)
- Accessibility (WCAG 2.1 AA)

---

## Next Steps

1. ✅ **Component breakdown complete** (this document)
2. ⏳ **Design mockups** (Figma/Sketch)
3. ⏳ **Component implementation** (React/TypeScript)
4. ⏳ **Integration with contracts** (wagmi/viem)
5. ⏳ **Testing** (unit, integration, E2E)

---

**Last Updated**: $(date)
**Status**: 📋 Component Breakdown Complete
**Total Components**: 49 (scoped for grant/demo)

