'use client';

import { Header } from "@/components/header";
import { useState, useEffect } from 'react';
import React from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, usePublicClient } from 'wagmi';
import { parseUnits, formatUnits, maxUint256, decodeEventLog, encodeFunctionData } from 'viem';
import { CONTRACTS, FLIP_CORE_ABI } from '@/lib/contracts';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TextScramble } from "@/components/ui/text-scramble";

// FXRP address on Coston2 Testnet
const FASSET_ADDRESS = CONTRACTS.coston2.FXRP;

// ERC20 ABI for approve and balanceOf
const ERC20_ABI = [
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// SettlementReceipt ABI
const SETTLEMENT_RECEIPT_ABI = [
  {
    inputs: [{ name: '_receiptId', type: 'uint256' }],
    name: 'getReceiptMetadata',
    outputs: [
      {
        components: [
          { name: 'redemptionId', type: 'uint256' },
          { name: 'asset', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'haircutRate', type: 'uint256' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'fdcRoundId', type: 'uint256' },
          { name: 'redeemed', type: 'bool' },
          { name: 'lp', type: 'address' },
        ],
        name: 'metadata',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'index', type: 'uint256' },
    ],
    name: 'tokenOfOwnerByIndex',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: '_receiptId', type: 'uint256' }],
    name: 'redeemNow',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: '_receiptId', type: 'uint256' }],
    name: 'redeemAfterFDC',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

// RedemptionRequested event ABI
const REDEMPTION_REQUESTED_EVENT = {
  anonymous: false,
  inputs: [
    { indexed: true, name: 'redemptionId', type: 'uint256' },
    { indexed: false, name: 'user', type: 'address' },
    { indexed: false, name: 'asset', type: 'address' },
    { indexed: false, name: 'amount', type: 'uint256' },
    { indexed: false, name: 'timestamp', type: 'uint256' },
  ],
  name: 'RedemptionRequested',
  type: 'event',
} as const;

export default function RedeemPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [amount, setAmount] = useState('');
  const [xrplAddress, setXrplAddress] = useState('');
  const [redemptionId, setRedemptionId] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [lastAction, setLastAction] = useState<'approve' | 'redeem' | 'process' | null>(null);
  const [receiptTokenIds, setReceiptTokenIds] = useState<bigint[]>([]);
  const [pendingRedemptions, setPendingRedemptions] = useState<{id: bigint, amount: bigint, xrplAddress: string}[]>([]);
  const [isOwner, setIsOwner] = useState(false);

  const { writeContract, data: hash, isPending, error: writeError, reset: resetWrite } = useWriteContract();
  
  // Handle writeContract errors
  useEffect(() => {
    if (writeError) {
      const errorMessage = writeError instanceof Error ? writeError.message : String(writeError);
      // Suppress known Wagmi v2 compatibility errors
      if (errorMessage.includes('getChainId') || errorMessage.includes('connection.connector')) {
        console.warn('Suppressed connector compatibility error:', writeError);
        return; // Don't show this error to the user
      }
      console.error('writeContract error:', writeError);
      setError(errorMessage || 'Transaction failed. Check console for details.');
      setLastAction(null);
    }
  }, [writeError]);
  
  // Handle writeContract success
  useEffect(() => {
    if (hash) {
      console.log('writeContract success, hash:', hash);
    }
  }, [hash]);
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Get FXRP decimals (FXRP uses 6 decimals, not 18)
  const { data: decimals } = useReadContract({
    address: FASSET_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'decimals',
    query: {
      enabled: !!address && isConnected,
    },
  });

  // Check FXRP balance
  const { data: balance } = useReadContract({
    address: FASSET_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && isConnected,
    },
  });

  // Check allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: FASSET_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && CONTRACTS.coston2.FLIPCore ? [address, CONTRACTS.coston2.FLIPCore] : undefined,
    query: {
      enabled: !!address && isConnected,
    },
  });

  // Get user's receipt count
  const { data: receiptBalance } = useReadContract({
    address: CONTRACTS.coston2.SettlementReceipt,
    abi: SETTLEMENT_RECEIPT_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && isConnected,
    },
  });

  // Get redemption data (with polling to track status changes)
  const { data: redemptionData, refetch: refetchRedemption } = useReadContract({
    address: CONTRACTS.coston2.FLIPCore,
    abi: FLIP_CORE_ABI,
    functionName: 'redemptions',
    args: redemptionId !== null ? [redemptionId] : undefined,
    query: {
      enabled: redemptionId !== null,
      refetchInterval: 10000, // Poll every 10 seconds to track status changes
    },
  });

  // Check if connected wallet is the FLIPCore owner
  const { data: ownerAddress } = useReadContract({
    address: CONTRACTS.coston2.FLIPCore,
    abi: FLIP_CORE_ABI,
    functionName: 'owner',
    query: {
      enabled: !!address && isConnected,
    },
  });

  // Get next redemption ID to know how many redemptions exist
  const { data: nextRedemptionId } = useReadContract({
    address: CONTRACTS.coston2.FLIPCore,
    abi: FLIP_CORE_ABI,
    functionName: 'nextRedemptionId',
    query: {
      enabled: !!address && isConnected,
      refetchInterval: 15000,
    },
  });

  // Check if user is owner
  useEffect(() => {
    if (ownerAddress && address) {
      setIsOwner(ownerAddress.toLowerCase() === address.toLowerCase());
    }
  }, [ownerAddress, address]);

  // Fetch pending redemptions (status = 0 means Pending)
  useEffect(() => {
    if (!publicClient || !nextRedemptionId || !isOwner) return;

    const fetchPendingRedemptions = async () => {
      const pending: {id: bigint, amount: bigint, xrplAddress: string}[] = [];
      const maxToCheck = Math.min(Number(nextRedemptionId), 20); // Check last 20 redemptions

      for (let i = Number(nextRedemptionId) - 1; i >= Math.max(0, Number(nextRedemptionId) - maxToCheck); i--) {
        try {
          const data = await publicClient.readContract({
            address: CONTRACTS.coston2.FLIPCore,
            abi: FLIP_CORE_ABI,
            functionName: 'redemptions',
            args: [BigInt(i)],
          });

          // status is at index 6, amount at index 2, xrplAddress at index 9
          const status = Number(data[6]);
          if (status === 0) { // Pending status
            pending.push({
              id: BigInt(i),
              amount: data[2],
              xrplAddress: data[9],
            });
          }
        } catch (e) {
          console.error(`Error fetching redemption ${i}:`, e);
        }
      }

      setPendingRedemptions(pending);
    };

    fetchPendingRedemptions();
  }, [publicClient, nextRedemptionId, isOwner]);

  // Status names mapping
  const STATUS_NAMES = [
    'Pending',           // 0 - Awaiting oracle prediction
    'QueuedForFDC',     // 1 - Low confidence, waiting for FDC
    'EscrowCreated',    // 2 - Escrow created, receipt minted
    'ReceiptRedeemed',  // 3 - Receipt redeemed (immediate or after FDC)
    'Finalized',        // 4 - FDC confirmed success
    'Failed',           // 5 - FDC confirmed failure
  ];

  // Fetch receipt token IDs
  useEffect(() => {
    if (receiptBalance && receiptBalance > BigInt(0) && address) {
      const fetchReceipts = async () => {
        const ids: bigint[] = [];
        for (let i = 0; i < Number(receiptBalance); i++) {
          try {
            const tokenId = await publicClient?.readContract({
              address: CONTRACTS.coston2.SettlementReceipt,
              abi: SETTLEMENT_RECEIPT_ABI,
              functionName: 'tokenOfOwnerByIndex',
              args: [address, BigInt(i)],
            });
            if (tokenId) ids.push(tokenId as bigint);
          } catch (e) {
            console.error('Error fetching receipt:', e);
          }
        }
        setReceiptTokenIds(ids);
      };
      fetchReceipts();
    }
  }, [receiptBalance, address, publicClient]);

  // Refetch allowance after approval succeeds
  useEffect(() => {
    if (isSuccess && lastAction === 'approve') {
      // Refetch allowance to update the UI immediately
      // Note: Don't clear lastAction here - it's needed for the success message display
      // It will be reset when the user starts a new transaction
      refetchAllowance();
    }
  }, [isSuccess, lastAction, refetchAllowance]);

  // Refetch redemption status after redemption succeeds
  useEffect(() => {
    if (isSuccess && lastAction === 'redeem' && redemptionId !== null) {
      // Start polling redemption status
      refetchRedemption();
    }
  }, [isSuccess, lastAction, redemptionId, refetchRedemption]);

  // Parse transaction logs to get redemptionId
  useEffect(() => {
    if (isSuccess && hash && lastAction === 'redeem' && publicClient) {
      const parseLogs = async () => {
        try {
          const receipt = await publicClient.getTransactionReceipt({ hash });
          for (const log of receipt.logs) {
            try {
              const decoded = decodeEventLog({
                abi: [REDEMPTION_REQUESTED_EVENT],
                data: log.data,
                topics: log.topics,
              });
              if (decoded.eventName === 'RedemptionRequested') {
                setRedemptionId(decoded.args.redemptionId as bigint);
                break;
              }
            } catch (e) {
              // Not the event we're looking for
            }
          }
        } catch (e) {
          console.error('Error parsing logs:', e);
        }
      };
      parseLogs();
    }
  }, [isSuccess, hash, lastAction, publicClient]);

  // Check if approval is needed
  React.useEffect(() => {
    if (amount && allowance !== undefined && decimals !== undefined) {
      const amountWei = parseUnits(amount, decimals);
      setNeedsApproval(allowance < amountWei);
    }
  }, [amount, allowance, decimals]);

  const handleApprove = () => {
    console.log('handleApprove called', {
      isConnected,
      address,
      decimals,
      FLIPCore: CONTRACTS.coston2.FLIPCore,
      FXRP: FASSET_ADDRESS,
      isPending,
      writeError,
    });

    if (!isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    if (decimals === undefined) {
      setError('Loading token decimals... Please wait.');
      return;
    }

    if (!CONTRACTS.coston2.FLIPCore) {
      setError('FLIPCore address not configured');
      return;
    }

    if (!FASSET_ADDRESS) {
      setError('FXRP token address not configured');
      return;
    }

    // Reset any previous transaction state
    resetWrite();

    setError(null);
    setLastAction('approve');
    
    // Approve unlimited (max uint256) - this is the standard pattern for DeFi
    // Users can revoke approval later if needed
    
    console.log('Calling writeContract with:', {
      address: FASSET_ADDRESS,
      functionName: 'approve',
      args: [CONTRACTS.coston2.FLIPCore, maxUint256.toString()],
    });
    
    try {
      // In wagmi v2, writeContract triggers the transaction
      // It should open MetaMask automatically
      writeContract({
        address: FASSET_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [CONTRACTS.coston2.FLIPCore, maxUint256],
      });
      console.log('writeContract called - MetaMask should open now');
    } catch (error: any) {
      // This catches synchronous validation errors
      console.error('Synchronous error calling writeContract:', error);
      console.error('Error details:', {
        name: error?.name,
        message: error?.message,
        shortMessage: error?.shortMessage,
        cause: error?.cause,
        stack: error?.stack,
      });
      setError(error?.message || error?.shortMessage || 'Failed to initiate approval. Check console for details.');
      setLastAction(null);
    }
  };

  const handleRequestRedemption = async () => {
    if (!amount || !isConnected || decimals === undefined) return;

    // Validate XRPL address
    if (!xrplAddress || !/^r[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(xrplAddress)) {
      setError('Please enter a valid XRPL address (starts with "r")');
      return;
    }

    try {
      // Reset previous transaction state
      resetWrite();
      setError(null);
      setLastAction('redeem');
      const amountWei = parseUnits(amount, decimals);
      
      // Check balance
      if (balance !== undefined && balance < amountWei) {
        setError('Insufficient FXRP balance');
        setLastAction(null);
        return;
      }

      // Estimate gas and add 50% buffer for safety
      let gasLimit: bigint | undefined;
      if (publicClient && address) {
        try {
          const data = encodeFunctionData({
            abi: FLIP_CORE_ABI,
            functionName: 'requestRedemption',
            args: [amountWei, FASSET_ADDRESS, xrplAddress],
          });
          const estimated = await publicClient.estimateGas({
            account: address,
            to: CONTRACTS.coston2.FLIPCore,
            data,
          });
          // Add 50% buffer to estimated gas
          gasLimit = (estimated * BigInt(150)) / BigInt(100);
        } catch (e) {
          console.warn('Gas estimation failed, using default:', e);
          gasLimit = BigInt(800000); // Fallback to safe default
        }
      } else {
        gasLimit = BigInt(800000); // Fallback if no publicClient
      }

      await writeContract({
        address: CONTRACTS.coston2.FLIPCore,
        abi: FLIP_CORE_ABI,
        functionName: 'requestRedemption',
        args: [amountWei, FASSET_ADDRESS, xrplAddress],
        gas: gasLimit,
      });
    } catch (error: any) {
      console.error('Error requesting redemption:', error);
      setError(error?.message || 'Failed to request redemption');
      setLastAction(null);
    }
  };

  // Process a pending redemption (owner only)
  const handleProcessRedemption = async (redemptionIdToProcess: bigint) => {
    if (!isOwner || !isConnected) {
      setError('Only the contract owner can process redemptions');
      return;
    }

    try {
      setError(null);
      setLastAction('process');

      // Default scoring parameters for high confidence
      const priceVolatility = BigInt(10000); // 1%
      const agentSuccessRate = BigInt(990000); // 99%
      const agentStake = BigInt('200000000000000000000000'); // 200k tokens

      await writeContract({
        address: CONTRACTS.coston2.FLIPCore,
        abi: FLIP_CORE_ABI,
        functionName: 'ownerProcessRedemption',
        args: [redemptionIdToProcess, priceVolatility, agentSuccessRate, agentStake],
        gas: BigInt(800000),
      });
    } catch (error: any) {
      console.error('Error processing redemption:', error);
      setError(error?.message || 'Failed to process redemption');
      setLastAction(null);
    }
  };

  const explorerUrl = CONTRACTS.networks.coston2.explorer;

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0b0f1f] via-black to-black text-white selection:bg-purple-500/30">
      <Header />
      
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <TextScramble text="REDEEM FASSETS" className="text-5xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500" />
            <p className="text-gray-400 text-lg">
              Unlock your native XRP with escrow-backed protection.
            </p>
          </div>

          <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-xl shadow-2xl shadow-purple-500/5">
            <CardHeader className="border-b border-gray-800/50 pb-8">
              <CardTitle className="text-2xl font-bold text-white">Request Redemption</CardTitle>
            </CardHeader>
            <CardContent className="pt-8 space-y-8">
              {!isConnected ? (
                <div className="text-center py-12 space-y-4">
                  <div className="mx-auto h-16 w-16 rounded-full bg-gray-800 flex items-center justify-center">
                    <span className="text-gray-500 text-3xl">!</span>
                  </div>
                  <p className="text-gray-400">Connect your wallet to start the redemption process</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {balance !== undefined && decimals !== undefined && (
                    <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-2xl p-6 border border-purple-500/20">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Your FXRP Balance</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-mono font-bold text-white">{formatUnits(balance, decimals)}</span>
                        <span className="text-sm font-medium text-purple-400">FXRP</span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-6">
                    <div className="space-y-4">
                      <label className="text-gray-300 text-sm uppercase tracking-wider font-semibold">Amount to Redeem</label>
                      <div className="relative group">
                        <input
                          type="number"
                          value={amount}
                          onChange={(e) => {
                            setAmount(e.target.value);
                            setError(null);
                          }}
                          placeholder="0.0"
                          className="w-full h-16 px-6 bg-gray-800/50 rounded-2xl border border-gray-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all text-white text-xl font-mono outline-none"
                        />
                        <div className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 font-bold">FXRP</div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="text-gray-300 text-sm uppercase tracking-wider font-semibold">Destination XRPL Address</label>
                      <input
                        type="text"
                        value={xrplAddress}
                        onChange={(e) => {
                          setXrplAddress(e.target.value);
                          setError(null);
                        }}
                        placeholder="r..."
                        className="w-full h-16 px-6 bg-gray-800/50 rounded-2xl border border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-white font-mono text-sm outline-none"
                      />
                      <p className="text-xs text-gray-500 italic pl-2">
                        The native XRP will be sent to this address once verified.
                      </p>
                    </div>
                  </div>

                  {error && !error.includes('getChainId') && !error.includes('connection.connector') && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                      <div className="h-5 w-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-white text-xs font-bold">!</span>
                      </div>
                      <div className="space-y-2 flex-1">
                        <p className="text-red-400 text-sm font-semibold">Error Occurred</p>
                        <p className="text-red-300/80 text-sm leading-relaxed">{error}</p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4 pt-4">
                    {needsApproval && (
                      <Button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleApprove();
                        }}
                        disabled={isPending || isConfirming || decimals === undefined || !isConnected}
                        className="w-full h-16 text-lg font-bold bg-white text-black hover:bg-gray-200 rounded-2xl transition-all hover:scale-[1.01] active:scale-[0.99]"
                      >
                        {isPending ? 'Waiting for Wallet...' : isConfirming ? 'Confirming Approval...' : 'Approve FXRP Usage'}
                      </Button>
                    )}

                    <Button
                      onClick={handleRequestRedemption}
                      disabled={!amount || !xrplAddress || isPending || isConfirming || needsApproval || decimals === undefined}
                      className="w-full h-16 text-lg font-bold bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 shadow-xl shadow-purple-500/20 rounded-2xl transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                    >
                      {isPending ? 'Initiating...' : isConfirming ? 'Redeeming...' : 'Request Instant Redemption'}
                    </Button>
                  </div>

                  {isSuccess && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
                      <div className="flex items-center gap-3">
                        <div className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold">✓</div>
                        <p className="text-emerald-400 font-bold">
                          {lastAction === 'approve' 
                            ? 'Approval Successful'
                            : 'Redemption Requested'}
                        </p>
                      </div>
                      
                      <div className="space-y-3 pl-9">
                        <p className="text-sm text-gray-400">
                          {lastAction === 'approve' 
                            ? 'You can now proceed with your redemption request.'
                            : 'Your request has been submitted to the Flare network.'}
                        </p>
                        <a
                          href={`${explorerUrl}/tx/${hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block text-blue-400 hover:text-blue-300 text-xs font-mono truncate max-w-full"
                        >
                          View: {hash}
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Owner: Pending Redemptions to Process */}
                  {isOwner && pendingRedemptions.length > 0 && (
                    <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-3xl p-8 space-y-6">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">⚙️</span>
                          <h3 className="text-lg font-bold text-white">Pending Redemptions (Owner)</h3>
                        </div>
                        <div className="h-8 w-8 bg-yellow-500/20 rounded-full flex items-center justify-center text-yellow-400 font-bold text-xs">
                          {pendingRedemptions.length}
                        </div>
                      </div>

                      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-sm">
                        <p className="text-yellow-300 mb-2 font-semibold">Action Required</p>
                        <p className="text-gray-400">
                          These redemptions are awaiting processing. Process them to create escrows and enable XRP delivery.
                        </p>
                      </div>

                      <div className="space-y-4">
                        {pendingRedemptions.map((redemption) => (
                          <div key={redemption.id.toString()} className="bg-gray-900/50 rounded-2xl border border-gray-800 p-6 space-y-4">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest font-mono">
                                Redemption #{redemption.id.toString()}
                              </span>
                              <span className="text-[10px] px-3 py-1 bg-yellow-500/10 text-yellow-400 rounded-full font-bold uppercase">
                                Pending
                              </span>
                            </div>
                            <div className="text-sm text-gray-400">
                              <p>Amount: <span className="text-white font-mono">{decimals !== undefined ? formatUnits(redemption.amount, decimals) : '...'} FXRP</span></p>
                              <p>XRPL: <span className="text-blue-300 font-mono text-xs">{redemption.xrplAddress}</span></p>
                            </div>
                            <Button
                              className="w-full h-12 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded-xl transition-all"
                              onClick={() => handleProcessRedemption(redemption.id)}
                              disabled={isPending || isConfirming}
                            >
                              {isPending || isConfirming ? 'Processing...' : 'Process Redemption'}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {redemptionData && decimals !== undefined && (
                    <div className="bg-blue-500/5 border border-blue-500/20 rounded-3xl p-8 space-y-6">
                      <div className="flex justify-between items-center">
                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Live Status</h3>
                        <div className="px-3 py-1 bg-blue-500/10 rounded-full">
                          <span className="text-[10px] font-black text-blue-400 uppercase animate-pulse">Polling Network</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Amount</p>
                          <p className="text-xl font-bold text-white">{formatUnits(redemptionData[2] as bigint, decimals)} <span className="text-sm font-normal text-gray-500">FXRP</span></p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Current Phase</p>
                          <p className={`text-xl font-bold ${
                            Number(redemptionData[6]) === 0 ? 'text-yellow-400' : 
                            Number(redemptionData[6]) === 2 ? 'text-blue-400' : 
                            Number(redemptionData[6]) === 4 ? 'text-emerald-400' : 
                            'text-white'
                          }`}>
                            {STATUS_NAMES[Number(redemptionData[6])] || 'Unknown'}
                          </p>
                        </div>
                      </div>

                      <div className="pt-6 border-t border-gray-800 space-y-4">
                        {redemptionData[4] && redemptionData[4] > BigInt(0) && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-500">Locked Price</span>
                            <span className="font-bold text-white">${(Number(redemptionData[4]) / 1e18).toFixed(4)} <span className="text-[10px] text-gray-500 uppercase font-normal ml-1">USD/XRP</span></span>
                          </div>
                        )}
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-500">Provisional Settlement</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${redemptionData[8] ? 'bg-emerald-500/10 text-emerald-500' : 'bg-gray-800 text-gray-500'}`}>
                            {redemptionData[8] ? 'Confirmed' : 'Pending'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {receiptBalance !== undefined && receiptBalance > BigInt(0) && (
                    <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-3xl p-8 space-y-6">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">⚡</span>
                          <h3 className="text-lg font-bold text-white">Your Settlement Receipts</h3>
                        </div>
                        <div className="h-8 w-8 bg-purple-500/20 rounded-full flex items-center justify-center text-purple-400 font-bold text-xs">
                          {receiptBalance.toString()}
                        </div>
                      </div>

                      <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 text-sm">
                        <p className="text-purple-300 mb-2 font-semibold">FLIP Instant Settlement Available!</p>
                        <p className="text-gray-400">
                          Get your XRP instantly with a ~0.3% fee, or wait for FDC verification (~3-5 min) for the full amount.
                        </p>
                      </div>

                      {receiptTokenIds.length > 0 && (
                        <div className="space-y-4">
                          {receiptTokenIds.map((tokenId) => (
                            <div key={tokenId.toString()} className="bg-gray-900/50 rounded-2xl border border-gray-800 p-6 space-y-5 transition-all hover:border-gray-700">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest font-mono">Receipt #{tokenId.toString()}</span>
                                <span className="text-[10px] px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full font-bold uppercase">Claimable</span>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Button
                                  className="h-14 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-purple-500/20"
                                  onClick={async () => {
                                    try {
                                      setError(null);
                                      await writeContract({
                                        address: CONTRACTS.coston2.SettlementReceipt,
                                        abi: SETTLEMENT_RECEIPT_ABI,
                                        functionName: 'redeemNow',
                                        args: [tokenId],
                                      });
                                    } catch (e: any) {
                                      setError(`Failed to redeem: ${e.message}`);
                                    }
                                  }}
                                  disabled={isPending || isConfirming}
                                >
                                  <span className="mr-2">⚡</span> Instant FLIP (~99.7%)
                                </Button>
                                <Button
                                  variant="outline"
                                  className="h-14 border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white rounded-xl transition-all"
                                  onClick={async () => {
                                    try {
                                      setError(null);
                                      await writeContract({
                                        address: CONTRACTS.coston2.SettlementReceipt,
                                        abi: SETTLEMENT_RECEIPT_ABI,
                                        functionName: 'redeemAfterFDC',
                                        args: [tokenId],
                                      });
                                    } catch (e: any) {
                                      setError(`Failed to redeem: ${e.message}`);
                                    }
                                  }}
                                  disabled={isPending || isConfirming}
                                >
                                  Wait for FDC (100%)
                                </Button>
                              </div>

                              <p className="text-[10px] text-gray-500 text-center">
                                FLIP pays you instantly • LP earns the small fee for taking the FDC wait risk
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="bg-gray-800/20 rounded-3xl p-8 border border-gray-800/50 space-y-6">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest text-center">How FLIP Redemption Works</h4>
                    <div className="space-y-6 relative">
                      {/* Vertical line */}
                      <div className="absolute left-3 top-2 bottom-2 w-px bg-gradient-to-b from-emerald-500 via-purple-500 to-blue-500 opacity-20" />

                      <div className="flex gap-4 items-start relative">
                        <div className="h-6 w-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center flex-shrink-0 z-10">
                          <span className="text-emerald-500 text-[10px]">1</span>
                        </div>
                        <p className="text-sm text-gray-400 leading-relaxed pt-0.5">
                          <strong className="text-white">Request Redemption:</strong> Your FXRP is locked and price is captured via FTSO oracle.
                        </p>
                      </div>

                      <div className="flex gap-4 items-start relative">
                        <div className="h-6 w-6 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center flex-shrink-0 z-10">
                          <span className="text-blue-500 text-[10px]">2</span>
                        </div>
                        <p className="text-sm text-gray-400 leading-relaxed pt-0.5">
                          <strong className="text-white">LP Matching:</strong> A liquidity provider is matched to fulfill your redemption instantly.
                        </p>
                      </div>

                      <div className="flex gap-4 items-start relative">
                        <div className="h-6 w-6 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center flex-shrink-0 z-10">
                          <span className="text-purple-500 text-[10px]">3</span>
                        </div>
                        <p className="text-sm text-gray-400 leading-relaxed pt-0.5">
                          <strong className="text-white">Settlement Receipt:</strong> You receive an NFT representing your XRP claim with two options:
                        </p>
                      </div>

                      <div className="ml-10 grid grid-cols-2 gap-4 text-xs">
                        <div className="bg-purple-500/10 rounded-xl p-4 border border-purple-500/20">
                          <p className="text-purple-400 font-bold mb-1">⚡ Instant FLIP</p>
                          <p className="text-gray-500">Get ~99.7% now. LP takes FDC wait risk for a small fee.</p>
                        </div>
                        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                          <p className="text-gray-300 font-bold mb-1">Wait for FDC</p>
                          <p className="text-gray-500">Get 100% after FDC verification (~3-5 minutes).</p>
                        </div>
                      </div>

                      <div className="flex gap-4 items-start relative">
                        <div className="h-6 w-6 rounded-full bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center flex-shrink-0 z-10">
                          <span className="text-yellow-500 text-[10px]">4</span>
                        </div>
                        <p className="text-sm text-gray-400 leading-relaxed pt-0.5">
                          <strong className="text-white">XRP Delivery:</strong> Native XRP is sent to your XRPL address via the LP network.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
