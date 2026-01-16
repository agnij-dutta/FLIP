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
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black">
        <Header />
        <div className="container mx-auto px-4 py-16">
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-gray-400">Please connect your wallet to manage LP positions</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black">
      <Header />
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl">Liquidity Provider Dashboard</CardTitle>
              <CardDescription>
                Provide liquidity and earn haircut fees on redemptions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {error && (
                <div className="bg-red-500/10 border border-red-500 rounded-lg p-4">
                  <p className="text-red-400">{error}</p>
                </div>
              )}

              {/* Current Position */}
              {position && position.active && (
                <Card className="bg-gray-800">
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
              <Card>
                <CardHeader>
                  <CardTitle>Deposit Liquidity</CardTitle>
                  <CardDescription>
                    Provide FLR liquidity to earn haircut fees on fast-lane redemptions
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Amount (FLR)</Label>
                    <Input
                      type="number"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="0.0"
                    />
                  </div>

                  <div>
                    <Label>Minimum Haircut (%)</Label>
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
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Minimum haircut you'll accept (e.g., 1% = 1.0)
                    </p>
                  </div>

                  <div>
                    <Label>Maximum Delay (seconds)</Label>
                    <Input
                      type="number"
                      value={maxDelay}
                      onChange={(e) => setMaxDelay(e.target.value)}
                      placeholder="3600"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Maximum delay you'll tolerate before FDC confirmation
                    </p>
                  </div>

                  <Button
                    onClick={handleDeposit}
                    disabled={!depositAmount || isPending || isWaitingTx || loading}
                    className="w-full"
                  >
                    {isPending || isWaitingTx ? 'Processing...' : 'Deposit Liquidity'}
                  </Button>
                </CardContent>
              </Card>

              {/* Withdraw Liquidity */}
              {position && position.active && (
                <Card>
                  <CardHeader>
                    <CardTitle>Withdraw Liquidity</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Amount (FLR)</Label>
                      <Input
                        type="number"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        placeholder="0.0"
                        max={position.availableAmount ? formatUnits(position.availableAmount, 18) : undefined}
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Available: {position.availableAmount ? formatUnits(position.availableAmount, 18) : '0'} FLR
                      </p>
                    </div>

                    <Button
                      onClick={handleWithdraw}
                      disabled={!withdrawAmount || isPending || isWaitingTx || loading}
                      className="w-full"
                      variant="outline"
                    >
                      {isPending || isWaitingTx ? 'Processing...' : 'Withdraw Liquidity'}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {txSuccess && (
                <div className="bg-green-500/10 border border-green-500 rounded-lg p-4">
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

