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
  const { address, isConnected, connector } = useAccount();
  const publicClient = usePublicClient();
  const [amount, setAmount] = useState('');
  const [xrplAddress, setXrplAddress] = useState('');
  const [redemptionId, setRedemptionId] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [lastAction, setLastAction] = useState<'approve' | 'redeem' | null>(null);
  const [receiptTokenIds, setReceiptTokenIds] = useState<bigint[]>([]);

  const { writeContract, data: hash, isPending, error: writeError, reset: resetWrite } = useWriteContract({
    onError: (error) => {
      console.error('writeContract error callback:', error);
      setError(error.message || error.shortMessage || 'Transaction failed. Check console for details.');
      setLastAction(null);
    },
    onSuccess: (hash) => {
      console.log('writeContract success callback:', hash);
    },
  });
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
      refetchAllowance();
      setLastAction(null);
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
      connector: connector?.name,
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

    if (!connector) {
      setError('Wallet connector not available. Please reconnect your wallet.');
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

    if (!FASSET_ADDRESS || FASSET_ADDRESS === '0x0000000000000000000000000000000000000000') {
      setError('FXRP token address not configured');
      return;
    }

    // Reset any previous errors
    if (writeError) {
      resetWrite();
    }
    
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

  const explorerUrl = CONTRACTS.networks.coston2.explorer;

  return (
    <main className="min-h-screen bg-gray-900 text-white">
      <Header />
      
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <TextScramble text="REDEEM FASSETS" className="text-4xl font-bold mb-4" />
            <p className="text-gray-400">
              Request instant redemption with escrow-backed protection
            </p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle>Request Redemption</CardTitle>
            </CardHeader>
            <CardContent>
              {!isConnected ? (
                <div className="text-center py-8">
                  <p className="text-gray-400 mb-4">Connect your wallet to get started</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {balance !== undefined && decimals !== undefined && (
                    <div className="mb-4 p-3 bg-gray-700/50 rounded-lg">
                      <p className="text-sm text-gray-400">Your FXRP Balance</p>
                      <p className="text-lg font-semibold">{formatUnits(balance, decimals)} FXRP</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium mb-2">Amount (FXRP)</label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => {
                        setAmount(e.target.value);
                        setError(null);
                      }}
                      placeholder="0.0"
                      className="w-full px-4 py-2 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">XRPL Address (where to receive XRP)</label>
                    <input
                      type="text"
                      value={xrplAddress}
                      onChange={(e) => {
                        setXrplAddress(e.target.value);
                        setError(null);
                      }}
                      placeholder="r..."
                      className="w-full px-4 py-2 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-white font-mono text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Your XRPL address where you want to receive XRP payments
                    </p>
                  </div>

                  {(error || writeError) && (
                    <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg">
                      <p className="text-red-400 text-sm font-semibold">Error:</p>
                      <p className="text-red-300 text-sm mt-1">
                        {error || writeError?.message || writeError?.shortMessage || 'Unknown error'}
                      </p>
                      {writeError && (
                        <details className="mt-2">
                          <summary className="text-xs text-red-400 cursor-pointer">Error details</summary>
                          <pre className="text-xs text-red-300 mt-1 overflow-auto">
                            {JSON.stringify(writeError, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  )}

                  {needsApproval && (
                    <div className="space-y-2">
                      <div className="p-3 bg-yellow-900/30 border border-yellow-700 rounded-lg">
                        <p className="text-yellow-400 text-sm">
                          ⚠️ Approval required: FLIPCore needs permission to use your FXRP tokens
                        </p>
                        <p className="text-yellow-300 text-xs mt-1">
                          This will approve unlimited spending (you can revoke later)
                        </p>
                      </div>
                      <Button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('Approve button clicked', { 
                            isPending, 
                            isConfirming, 
                            decimals, 
                            isConnected,
                            FLIPCore: CONTRACTS.coston2.FLIPCore,
                            FXRP: FASSET_ADDRESS
                          });
                          handleApprove();
                        }}
                        disabled={isPending || isConfirming || decimals === undefined || !isConnected}
                        className="w-full"
                        size="lg"
                        variant="outline"
                      >
                        {isPending ? 'Approving...' : isConfirming ? 'Confirming...' : 'Approve Unlimited FXRP'}
                      </Button>
                    </div>
                  )}

                  <Button
                    onClick={handleRequestRedemption}
                    disabled={!amount || !xrplAddress || isPending || isConfirming || needsApproval || decimals === undefined}
                    className="w-full"
                    size="lg"
                  >
                    {isPending ? 'Requesting...' : isConfirming ? 'Confirming...' : 'Request Redemption'}
                  </Button>

                  {isSuccess && (
                    <div className="mt-4 p-4 bg-green-900/30 border border-green-700 rounded-lg">
                      <p className="text-green-400 font-semibold">
                        {lastAction === 'approve' 
                          ? '✅ Approval successful! You can now request redemption.'
                          : '✅ Redemption requested successfully!'}
                      </p>
                      <p className="text-sm text-gray-400 mt-2">
                        Transaction:{' '}
                        <a
                          href={`${explorerUrl}/tx/${hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:underline break-all"
                        >
                          {hash}
                        </a>
                      </p>
                      {lastAction === 'redeem' && redemptionId !== null && (
                        <p className="text-sm text-gray-300 mt-2">
                          Redemption ID: {redemptionId.toString()}
                        </p>
                      )}
                    </div>
                  )}

                  {redemptionData && decimals !== undefined && (
                    <div className="mt-4 p-4 bg-blue-900/30 border border-blue-700 rounded-lg">
                      <p className="text-blue-400 font-semibold mb-3">📊 Redemption Status (Live Updates)</p>
                      <div className="text-sm text-gray-300 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Amount:</span>
                          <span className="font-semibold">{formatUnits(redemptionData[2] as bigint, decimals)} FXRP</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Status:</span>
                          <span className={`font-semibold ${
                            Number(redemptionData[6]) === 0 ? 'text-yellow-400' : // Pending
                            Number(redemptionData[6]) === 2 ? 'text-blue-400' : // EscrowCreated
                            Number(redemptionData[6]) === 4 ? 'text-green-400' : // Finalized
                            Number(redemptionData[6]) === 5 ? 'text-red-400' : // Failed
                            'text-gray-300'
                          }`}>
                            {STATUS_NAMES[Number(redemptionData[6])] || 'Unknown'}
                          </span>
                        </div>
                        {redemptionData[4] && redemptionData[4] > BigInt(0) && (
                          <div className="flex justify-between">
                            <span className="text-gray-400">Price Locked:</span>
                            <span className="font-semibold">
                              ${(Number(redemptionData[4]) / 1e18).toFixed(4)}/XRP
                            </span>
                          </div>
                        )}
                        {redemptionData[5] && redemptionData[5] > BigInt(0) && (
                          <div className="flex justify-between">
                            <span className="text-gray-400">Hedge ID:</span>
                            <span className="font-mono text-xs">{redemptionData[5].toString()}</span>
                          </div>
                        )}
                        {redemptionData[8] && (
                          <div className="flex justify-between">
                            <span className="text-gray-400">Provisional Settled:</span>
                            <span className={redemptionData[8] ? 'text-green-400' : 'text-gray-500'}>
                              {redemptionData[8] ? '✅ Yes' : '❌ No'}
                            </span>
                          </div>
                        )}
                        <div className="pt-2 mt-2 border-t border-gray-600">
                          <p className="text-xs text-gray-400">
                            💡 Status updates automatically every 10 seconds
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {receiptBalance !== undefined && receiptBalance > BigInt(0) && (
                    <div className="mt-4 p-4 bg-purple-900/30 border border-purple-700 rounded-lg">
                      <p className="text-purple-400 font-semibold">
                        🎫 Your Settlement Receipts ({receiptBalance.toString()})
                      </p>
                      <p className="text-sm text-gray-300 mt-2">
                        You have {receiptBalance.toString()} settlement receipt{Number(receiptBalance) !== 1 ? 's' : ''} that can be redeemed.
                      </p>
                      {receiptTokenIds.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {receiptTokenIds.map((tokenId) => (
                            <div key={tokenId.toString()} className="p-2 bg-gray-800 rounded border border-gray-600">
                              <p className="text-xs text-gray-400 mb-2">Receipt #{tokenId.toString()}</p>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
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
                                      setError(`Failed to redeem receipt: ${e.message}`);
                                    }
                                  }}
                                  disabled={isPending || isConfirming}
                                >
                                  Redeem Now (with haircut)
                                </Button>
                                <Button
                                  size="sm"
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
                                      setError(`Failed to redeem receipt: ${e.message}`);
                                    }
                                  }}
                                  disabled={isPending || isConfirming}
                                >
                                  Wait for FDC (full amount)
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-6 p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                    <p className="text-sm font-semibold text-gray-200 mb-2">📋 What Happens During Redemption?</p>
                    <div className="text-xs text-gray-300 space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="text-green-400">✅</span>
                        <span><strong>Immediate:</strong> Your FXRP balance decreases (tokens burned to dead address)</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-blue-400">🔒</span>
                        <span><strong>Immediate:</strong> Price is locked via FTSO (protects against price movements)</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-purple-400">🎫</span>
                        <span><strong>Within Minutes:</strong> Settlement Receipt NFT is minted to your wallet</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-yellow-400">⏳</span>
                        <span><strong>After ~1-2 Days:</strong> FDC confirms the cross-chain transaction</span>
                      </div>
                      <div className="mt-3 pt-2 border-t border-gray-600">
                        <p className="text-gray-400">
                          🔒 <strong>FDC is the final judge.</strong> FLIP only changes when users get paid.
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
