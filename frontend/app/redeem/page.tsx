'use client';

import { Header } from "@/components/header";
import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { CONTRACTS, FLIP_CORE_ABI } from '@/lib/contracts';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TextScramble } from "@/components/ui/text-scramble";

// Placeholder FAsset address - update with actual address
const FASSET_ADDRESS = '0x0000000000000000000000000000000000000000';

export default function RedeemPage() {
  const { address, isConnected } = useAccount();
  const [amount, setAmount] = useState('');
  const [redemptionId, setRedemptionId] = useState<bigint | null>(null);

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const { data: redemptionData } = useReadContract({
    address: CONTRACTS.coston2.FLIPCore,
    abi: FLIP_CORE_ABI,
    functionName: 'redemptions',
    args: redemptionId !== null ? [redemptionId] : undefined,
    query: {
      enabled: redemptionId !== null,
    },
  });

  const handleRequestRedemption = async () => {
    if (!amount || !isConnected) return;

    try {
      const amountWei = parseEther(amount);
      await writeContract({
        address: CONTRACTS.coston2.FLIPCore,
        abi: FLIP_CORE_ABI,
        functionName: 'requestRedemption',
        args: [amountWei, FASSET_ADDRESS],
      });
    } catch (error) {
      console.error('Error requesting redemption:', error);
    }
  };

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
                  <div>
                    <label className="block text-sm font-medium mb-2">Amount (FXRP)</label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.0"
                      className="w-full px-4 py-2 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-white"
                    />
                  </div>

                  <Button
                    onClick={handleRequestRedemption}
                    disabled={!amount || isPending || isConfirming}
                    className="w-full"
                    size="lg"
                  >
                    {isPending ? 'Requesting...' : isConfirming ? 'Confirming...' : 'Request Redemption'}
                  </Button>

                  {isSuccess && (
                    <div className="mt-4 p-4 bg-green-900/30 border border-green-700 rounded-lg">
                      <p className="text-green-400">Redemption requested successfully!</p>
                      <p className="text-sm text-gray-400 mt-2">Transaction: {hash}</p>
                    </div>
                  )}

                  {redemptionData && (
                    <div className="mt-4 p-4 bg-blue-900/30 border border-blue-700 rounded-lg">
                      <p className="text-blue-400">Redemption Status</p>
                      <p className="text-sm text-gray-300 mt-2">
                        Amount: {formatEther(redemptionData[2] as bigint)} FXRP
                      </p>
                    </div>
                  )}

                  <div className="mt-6 p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                    <p className="text-sm text-gray-300">
                      🔒 <strong>FDC is the final judge.</strong> FLIP only changes when users get paid.
                    </p>
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

