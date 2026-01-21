'use client';

import { Header } from "@/components/header";
import { useState, useEffect } from 'react';
import React from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, usePublicClient } from 'wagmi';
import { parseUnits, formatUnits, Address } from 'viem';
import { CONTRACTS } from '@/lib/contracts';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// LiquidityProviderRegistry ABI
const LP_REGISTRY_ABI = [
  {
    inputs: [
      { name: '_asset', type: 'address' },
      { name: '_amount', type: 'uint256' },
      { name: '_minHaircut', type: 'uint256' },
      { name: '_maxDelay', type: 'uint256' },
    ],
    name: 'depositLiquidity',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { name: '_asset', type: 'address' },
      { name: '_amount', type: 'uint256' },
    ],
    name: 'withdrawLiquidity',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: '_lp', type: 'address' },
      { name: '_asset', type: 'address' },
    ],
    name: 'getPosition',
    outputs: [
      {
        components: [
          { name: 'lp', type: 'address' },
          { name: 'asset', type: 'address' },
          { name: 'depositedAmount', type: 'uint256' },
          { name: 'availableAmount', type: 'uint256' },
          { name: 'minHaircut', type: 'uint256' },
          { name: 'maxDelay', type: 'uint256' },
          { name: 'totalEarned', type: 'uint256' },
          { name: 'active', type: 'bool' },
        ],
        name: 'position',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const FXRP_ADDRESS = CONTRACTS.coston2.FXRP as Address;

export default function LPDashboard() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isWaitingTx, isSuccess: txSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // State
  const [depositAmount, setDepositAmount] = useState('');
  const [minHaircut, setMinHaircut] = useState('10000'); // 1% = 10000 (scaled: 1000000 = 100%)
  const [maxDelay, setMaxDelay] = useState('3600'); // 1 hour in seconds
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [position, setPosition] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch LP position
  const { data: positionData, refetch: refetchPosition } = useReadContract({
    address: CONTRACTS.coston2.LiquidityProviderRegistry,
    abi: LP_REGISTRY_ABI,
    functionName: 'getPosition',
    args: address && isConnected ? [address, FXRP_ADDRESS] : undefined,
    query: {
      enabled: !!address && isConnected,
    },
  });

  useEffect(() => {
    if (positionData) {
      setPosition(positionData);
    }
  }, [positionData]);

  // Refetch position after successful transaction
  useEffect(() => {
    if (txSuccess) {
      refetchPosition();
      setDepositAmount('');
      setWithdrawAmount('');
    }
  }, [txSuccess, refetchPosition]);

  const handleDeposit = async () => {
    if (!depositAmount || !isConnected) return;

    try {
      setError(null);
      setLoading(true);

      const amountWei = parseUnits(depositAmount, 18); // FLR uses 18 decimals
      const minHaircutScaled = BigInt(minHaircut);
      const maxDelaySeconds = BigInt(maxDelay);

      await writeContract({
        address: CONTRACTS.coston2.LiquidityProviderRegistry,
        abi: LP_REGISTRY_ABI,
        functionName: 'depositLiquidity',
        args: [FXRP_ADDRESS, amountWei, minHaircutScaled, maxDelaySeconds],
        value: amountWei,
      });
    } catch (err: any) {
      setError(`Failed to deposit: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || !isConnected) return;

    try {
      setError(null);
      setLoading(true);

      const amountWei = parseUnits(withdrawAmount, 18);

      await writeContract({
        address: CONTRACTS.coston2.LiquidityProviderRegistry,
        abi: LP_REGISTRY_ABI,
        functionName: 'withdrawLiquidity',
        args: [FXRP_ADDRESS, amountWei],
      });
    } catch (err: any) {
      setError(`Failed to withdraw: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0b0f1f] via-black to-black">
        <Header />
        <div className="container mx-auto px-4 py-16">
          <Card className="bg-gray-900/60 border-gray-800 text-white">
            <CardContent className="pt-6">
              <p className="text-center text-gray-400">Please connect your wallet to manage LP positions</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b0f1f] via-black to-black text-white">
      <Header />
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card className="bg-gray-900/60 border-gray-800 backdrop-blur-xl shadow-2xl shadow-purple-500/10">
            <CardHeader className="border-b border-gray-800/60 pb-6">
              <CardTitle className="text-3xl font-bold">Liquidity Provider Dashboard</CardTitle>
              <CardDescription className="text-gray-400">
                Provide liquidity and earn haircut fees on redemptions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              {error && (
                <div className="bg-red-500/10 border border-red-500 rounded-lg p-4">
                  <p className="text-red-400">{error}</p>
                </div>
              )}

              {/* Current Position */}
              {position && position.active && (
                <Card className="bg-gray-900/50 border-gray-800">
                  <CardHeader>
                    <CardTitle>Your LP Position</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Deposited:</span>
                      <span className="font-semibold">{formatUnits(position.depositedAmount, 18)} FLR</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Available:</span>
                      <span className="font-semibold">{formatUnits(position.availableAmount, 18)} FLR</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total Earned:</span>
                      <span className="font-semibold text-green-400">{formatUnits(position.totalEarned, 18)} FLR</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Min Haircut:</span>
                      <span className="font-semibold">{(Number(position.minHaircut) / 10000).toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Max Delay:</span>
                      <span className="font-semibold">{Number(position.maxDelay)} seconds</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Deposit Liquidity */}
              <Card className="bg-gray-900/50 border-gray-800">
                <CardHeader>
                  <CardTitle>Deposit Liquidity</CardTitle>
                  <CardDescription className="text-gray-400">
                    Provide FLR liquidity to earn haircut fees on fast-lane redemptions.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-gray-300 text-sm uppercase tracking-wider font-semibold">Amount (FLR)</Label>
                    <Input
                      type="number"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="0.0"
                      className="bg-gray-800/50 border-gray-700 h-12 focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300 text-sm uppercase tracking-wider font-semibold">Minimum Haircut (%)</Label>
                    <Input
                      type="number"
                      value={(Number(minHaircut) / 10000).toFixed(2)}
                      onChange={(e) => {
                        const percent = parseFloat(e.target.value);
                        if (!isNaN(percent)) {
                          setMinHaircut(Math.floor(percent * 10000).toString());
                        }
                      }}
                      placeholder="1.0"
                      step="0.01"
                      className="bg-gray-800/50 border-gray-700 h-12 focus:ring-purple-500 focus:border-purple-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Minimum haircut you&apos;ll accept (e.g., 1% = 1.0)
                    </p>
                  </div>

                  <div>
                    <Label className="text-gray-300 text-sm uppercase tracking-wider font-semibold">Maximum Delay (seconds)</Label>
                    <Input
                      type="number"
                      value={maxDelay}
                      onChange={(e) => setMaxDelay(e.target.value)}
                      placeholder="3600"
                      className="bg-gray-800/50 border-gray-700 h-12 focus:ring-purple-500 focus:border-purple-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Maximum delay you&apos;ll tolerate before FDC confirmation
                    </p>
                  </div>

                  <Button
                    onClick={handleDeposit}
                    disabled={!depositAmount || isPending || isWaitingTx || loading}
                    className="w-full h-12 text-base font-bold bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 shadow-lg shadow-purple-500/20"
                  >
                    {isPending || isWaitingTx ? 'Processing...' : 'Deposit Liquidity'}
                  </Button>
                </CardContent>
              </Card>

              {/* Withdraw Liquidity */}
              {position && position.active && (
                <Card className="bg-gray-900/50 border-gray-800">
                  <CardHeader>
                    <CardTitle>Withdraw Liquidity</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-gray-300 text-sm uppercase tracking-wider font-semibold">Amount (FLR)</Label>
                      <Input
                        type="number"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        placeholder="0.0"
                        max={position.availableAmount ? formatUnits(position.availableAmount, 18) : undefined}
                        className="bg-gray-800/50 border-gray-700 h-12 focus:ring-purple-500 focus:border-purple-500"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Available: {position.availableAmount ? formatUnits(position.availableAmount, 18) : '0'} FLR
                      </p>
                    </div>

                    <Button
                      onClick={handleWithdraw}
                      disabled={!withdrawAmount || isPending || isWaitingTx || loading}
                      className="w-full h-12 text-base font-semibold border-purple-500/40 text-purple-300 hover:text-white hover:border-purple-400"
                      variant="outline"
                    >
                      {isPending || isWaitingTx ? 'Processing...' : 'Withdraw Liquidity'}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {txSuccess && (
                <div className="bg-green-500/10 border border-green-500/40 rounded-lg p-4">
                  <p className="text-green-400">Transaction successful!</p>
                  <p className="text-sm text-gray-400 mt-1">
                    <a
                      href={`${CONTRACTS.networks.coston2.explorer}/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline"
                    >
                      View on explorer
                    </a>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

