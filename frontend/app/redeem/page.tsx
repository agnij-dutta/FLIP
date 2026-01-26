'use client';

import { Header } from "@/components/header";
import { useState, useEffect } from 'react';
import React from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, usePublicClient } from 'wagmi';
import { parseUnits, formatUnits, maxUint256, decodeEventLog, encodeFunctionData } from 'viem';
import { CONTRACTS, FLIP_CORE_ABI } from '@/lib/contracts';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Zap, Clock, AlertCircle, CheckCircle, Loader2, ExternalLink } from "lucide-react";

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

  useEffect(() => {
    if (writeError) {
      const errorMessage = writeError instanceof Error ? writeError.message : String(writeError);
      if (errorMessage.includes('getChainId') || errorMessage.includes('connection.connector')) {
        console.warn('Suppressed connector compatibility error:', writeError);
        return;
      }
      console.error('writeContract error:', writeError);
      setError(errorMessage || 'Transaction failed. Check console for details.');
      setLastAction(null);
    }
  }, [writeError]);

  useEffect(() => {
    if (hash) {
      console.log('writeContract success, hash:', hash);
    }
  }, [hash]);

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const { data: decimals } = useReadContract({
    address: FASSET_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'decimals',
    query: {
      enabled: !!address && isConnected,
    },
  });

  const { data: balance } = useReadContract({
    address: FASSET_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && isConnected,
    },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: FASSET_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && CONTRACTS.coston2.FLIPCore ? [address, CONTRACTS.coston2.FLIPCore] : undefined,
    query: {
      enabled: !!address && isConnected,
    },
  });

  const { data: receiptBalance } = useReadContract({
    address: CONTRACTS.coston2.SettlementReceipt,
    abi: SETTLEMENT_RECEIPT_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && isConnected,
    },
  });

  const { data: redemptionData, refetch: refetchRedemption } = useReadContract({
    address: CONTRACTS.coston2.FLIPCore,
    abi: FLIP_CORE_ABI,
    functionName: 'redemptions',
    args: redemptionId !== null ? [redemptionId] : undefined,
    query: {
      enabled: redemptionId !== null,
      refetchInterval: 10000,
    },
  });

  const { data: ownerAddress } = useReadContract({
    address: CONTRACTS.coston2.FLIPCore,
    abi: FLIP_CORE_ABI,
    functionName: 'owner',
    query: {
      enabled: !!address && isConnected,
    },
  });

  const { data: nextRedemptionId } = useReadContract({
    address: CONTRACTS.coston2.FLIPCore,
    abi: FLIP_CORE_ABI,
    functionName: 'nextRedemptionId',
    query: {
      enabled: !!address && isConnected,
      refetchInterval: 15000,
    },
  });

  useEffect(() => {
    if (ownerAddress && address) {
      setIsOwner(ownerAddress.toLowerCase() === address.toLowerCase());
    }
  }, [ownerAddress, address]);

  useEffect(() => {
    if (!publicClient || !nextRedemptionId || !isOwner) return;

    const fetchPendingRedemptions = async () => {
      const pending: {id: bigint, amount: bigint, xrplAddress: string}[] = [];
      const maxToCheck = Math.min(Number(nextRedemptionId), 20);

      for (let i = Number(nextRedemptionId) - 1; i >= Math.max(0, Number(nextRedemptionId) - maxToCheck); i--) {
        try {
          const data = await publicClient.readContract({
            address: CONTRACTS.coston2.FLIPCore,
            abi: FLIP_CORE_ABI,
            functionName: 'redemptions',
            args: [BigInt(i)],
          });

          const status = Number(data[6]);
          if (status === 0) {
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

  const STATUS_NAMES = [
    'Pending',
    'QueuedForFDC',
    'EscrowCreated',
    'ReceiptRedeemed',
    'Finalized',
    'Failed',
  ];

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

  useEffect(() => {
    if (isSuccess && lastAction === 'approve') {
      refetchAllowance();
    }
  }, [isSuccess, lastAction, refetchAllowance]);

  useEffect(() => {
    if (isSuccess && lastAction === 'redeem' && redemptionId !== null) {
      refetchRedemption();
    }
  }, [isSuccess, lastAction, redemptionId, refetchRedemption]);

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

  React.useEffect(() => {
    if (amount && allowance !== undefined && decimals !== undefined) {
      const amountWei = parseUnits(amount, decimals);
      setNeedsApproval(allowance < amountWei);
    }
  }, [amount, allowance, decimals]);

  const handleApprove = () => {
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

    resetWrite();
    setError(null);
    setLastAction('approve');

    try {
      writeContract({
        address: FASSET_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [CONTRACTS.coston2.FLIPCore, maxUint256],
      });
    } catch (error: any) {
      console.error('Synchronous error calling writeContract:', error);
      setError(error?.message || error?.shortMessage || 'Failed to initiate approval. Check console for details.');
      setLastAction(null);
    }
  };

  const handleRequestRedemption = async () => {
    if (!amount || !isConnected || decimals === undefined) return;

    if (!xrplAddress || !/^r[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(xrplAddress)) {
      setError('Please enter a valid XRPL address (starts with "r")');
      return;
    }

    try {
      resetWrite();
      setError(null);
      setLastAction('redeem');
      const amountWei = parseUnits(amount, decimals);

      if (balance !== undefined && balance < amountWei) {
        setError('Insufficient FXRP balance');
        setLastAction(null);
        return;
      }

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
          gasLimit = (estimated * BigInt(150)) / BigInt(100);
        } catch (e) {
          console.warn('Gas estimation failed, using default:', e);
          gasLimit = BigInt(800000);
        }
      } else {
        gasLimit = BigInt(800000);
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

  const handleProcessRedemption = async (redemptionIdToProcess: bigint) => {
    if (!isOwner || !isConnected) {
      setError('Only the contract owner can process redemptions');
      return;
    }

    try {
      setError(null);
      setLastAction('process');

      const priceVolatility = BigInt(10000);
      const agentSuccessRate = BigInt(990000);
      const agentStake = BigInt('200000000000000000000000');

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
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Header />

      {/* Hero Section */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-12 sm:py-16">
          <div className="text-center">
            <span className="section-label">FAsset Redemption</span>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mt-4 mb-4">
              Redeem Your <span className="text-gradient">FAssets</span>
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Convert FXRP back to native XRP with instant settlement options.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        {/* Main Redemption Card */}
        <Card className="mb-8 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-flare-pink/5 to-transparent border-b border-gray-100">
            <CardTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-flare-pink/10 flex items-center justify-center">
                <ArrowRight className="w-5 h-5 text-flare-pink" />
              </div>
              Request Redemption
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {!isConnected ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Connect Your Wallet</h3>
                <p className="text-gray-500">Please connect your wallet to start the redemption process.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Balance Display */}
                {balance !== undefined && decimals !== undefined && (
                  <div className="p-5 rounded-2xl bg-gradient-to-r from-flare-pink/10 to-flare-pink/5 border border-flare-pink/20">
                    <p className="text-sm font-semibold text-gray-500 mb-1">Your FXRP Balance</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-gray-900 number-display">
                        {formatUnits(balance, decimals)}
                      </span>
                      <span className="text-flare-pink font-semibold">FXRP</span>
                    </div>
                  </div>
                )}

                {/* Input Fields */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Amount to Redeem
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => {
                          setAmount(e.target.value);
                          setError(null);
                        }}
                        placeholder="0.00"
                        className="input-modern pr-20 text-lg font-medium"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">
                        FXRP
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Destination XRPL Address
                    </label>
                    <input
                      type="text"
                      value={xrplAddress}
                      onChange={(e) => {
                        setXrplAddress(e.target.value);
                        setError(null);
                      }}
                      placeholder="r..."
                      className="input-modern font-mono text-sm"
                    />
                    <p className="mt-2 text-xs text-gray-500">
                      Your native XRP will be sent to this address once verified.
                    </p>
                  </div>
                </div>

                {/* Error Display */}
                {error && !error.includes('getChainId') && !error.includes('connection.connector') && (
                  <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-red-700">Error</p>
                      <p className="text-sm text-red-600">{error}</p>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-3 pt-2">
                  {needsApproval && (
                    <Button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleApprove();
                      }}
                      disabled={isPending || isConfirming || decimals === undefined || !isConnected}
                      className="w-full"
                      size="lg"
                      variant="secondary"
                    >
                      {isPending || isConfirming ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          {isPending ? 'Confirming...' : 'Processing...'}
                        </>
                      ) : (
                        'Approve FXRP Usage'
                      )}
                    </Button>
                  )}

                  <Button
                    onClick={handleRequestRedemption}
                    disabled={!amount || !xrplAddress || isPending || isConfirming || needsApproval || decimals === undefined}
                    className="w-full"
                    size="lg"
                  >
                    {isPending || isConfirming ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        {isPending ? 'Confirming...' : 'Processing...'}
                      </>
                    ) : (
                      <>
                        Request Instant Redemption
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </>
                    )}
                  </Button>
                </div>

                {/* Success Message */}
                {isSuccess && (
                  <div className="p-5 rounded-xl bg-green-50 border border-green-200">
                    <div className="flex items-center gap-3 mb-3">
                      <CheckCircle className="w-6 h-6 text-green-500" />
                      <span className="font-semibold text-green-700">
                        {lastAction === 'approve' ? 'Approval Successful' : 'Redemption Requested'}
                      </span>
                    </div>
                    <p className="text-sm text-green-600 mb-3">
                      {lastAction === 'approve'
                        ? 'You can now proceed with your redemption request.'
                        : 'Your request has been submitted to the Flare network.'}
                    </p>
                    <a
                      href={`${explorerUrl}/tx/${hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-green-700 hover:text-green-800 font-medium"
                    >
                      View Transaction
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Owner: Pending Redemptions */}
        {isOwner && pendingRedemptions.length > 0 && (
          <Card className="mb-8 border-amber-200 bg-amber-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-amber-800">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                Pending Redemptions (Owner)
                <span className="ml-auto px-3 py-1 bg-amber-200 text-amber-800 rounded-full text-sm font-semibold">
                  {pendingRedemptions.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-amber-700">
                These redemptions are awaiting processing. Process them to create escrows and enable XRP delivery.
              </p>
              {pendingRedemptions.map((redemption) => (
                <div key={redemption.id.toString()} className="p-4 bg-white rounded-xl border border-amber-200">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-sm font-semibold text-gray-500">
                      Redemption #{redemption.id.toString()}
                    </span>
                    <span className="badge-pink">Pending</span>
                  </div>
                  <div className="text-sm text-gray-600 mb-4">
                    <p>Amount: <span className="font-semibold text-gray-900">{decimals !== undefined ? formatUnits(redemption.amount, decimals) : '...'} FXRP</span></p>
                    <p className="truncate">XRPL: <span className="font-mono text-xs">{redemption.xrplAddress}</span></p>
                  </div>
                  <Button
                    className="w-full bg-amber-500 hover:bg-amber-600"
                    onClick={() => handleProcessRedemption(redemption.id)}
                    disabled={isPending || isConfirming}
                  >
                    {isPending || isConfirming ? 'Processing...' : 'Process Redemption'}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Redemption Status */}
        {redemptionData && decimals !== undefined && (
          <Card className="mb-8 border-blue-200 bg-blue-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-blue-800">
                Live Status
                <span className="ml-auto flex items-center gap-2 text-sm font-normal text-blue-600">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  Polling Network
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Amount</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatUnits(redemptionData[2] as bigint, decimals)}
                    <span className="text-sm font-normal text-gray-500 ml-1">FXRP</span>
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Current Phase</p>
                  <p className={`text-2xl font-bold ${
                    Number(redemptionData[6]) === 0 ? 'text-amber-500' :
                    Number(redemptionData[6]) === 2 ? 'text-blue-500' :
                    Number(redemptionData[6]) === 4 ? 'text-green-500' :
                    'text-gray-900'
                  }`}>
                    {STATUS_NAMES[Number(redemptionData[6])] || 'Unknown'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Settlement Receipts */}
        {receiptBalance !== undefined && receiptBalance > BigInt(0) && (
          <Card className="mb-8 card-pink">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-flare-pink/10 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-flare-pink" />
                </div>
                Your Settlement Receipts
                <span className="ml-auto px-3 py-1 bg-flare-pink/10 text-flare-pink rounded-full text-sm font-semibold">
                  {receiptBalance.toString()}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-xl bg-white border border-flare-pink/20">
                <p className="font-semibold text-flare-pink mb-1">FLIP Instant Settlement Available!</p>
                <p className="text-sm text-gray-600">
                  Get your XRP instantly with a ~0.3% fee, or wait for FDC verification (~3-5 min) for the full amount.
                </p>
              </div>

              {receiptTokenIds.map((tokenId) => (
                <div key={tokenId.toString()} className="p-5 bg-white rounded-xl border border-gray-200 hover:border-flare-pink/30 transition-all">
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-mono text-sm text-gray-500">Receipt #{tokenId.toString()}</span>
                    <span className="badge-success">Claimable</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Button
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
                      <Zap className="w-4 h-4 mr-2" />
                      Instant (~99.7%)
                    </Button>
                    <Button
                      variant="outline"
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
                      <Clock className="w-4 h-4 mr-2" />
                      Wait (100%)
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* How It Works */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">How FLIP Redemption Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { step: '1', title: 'Request Redemption', description: 'Your FXRP is locked and price is captured via FTSO oracle.' },
                { step: '2', title: 'LP Matching', description: 'A liquidity provider is matched to fulfill your redemption instantly.' },
                { step: '3', title: 'Settlement Receipt', description: 'You receive an NFT representing your XRP claim with two options.' },
                { step: '4', title: 'XRP Delivery', description: 'Native XRP is sent to your XRPL address via the LP network.' },
              ].map((item) => (
                <div key={item.step} className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-lg bg-flare-pink/10 text-flare-pink flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {item.step}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">{item.title}</h4>
                    <p className="text-sm text-gray-500">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
