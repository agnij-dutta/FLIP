'use client';

import { Header } from "@/components/header";
import { useState, useEffect } from 'react';
import React from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, usePublicClient } from 'wagmi';
import { parseUnits, formatUnits, Address } from 'viem';
import { CONTRACTS } from '@/lib/contracts';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TrendingUp, Wallet, Clock, Percent, AlertCircle, CheckCircle, Loader2, ExternalLink, PiggyBank, ArrowDownToLine } from "lucide-react";

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
      <main className="min-h-screen bg-gray-50">
        <Header />
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-4xl mx-auto px-4 py-12 sm:py-16">
            <div className="text-center">
              <span className="section-label">Liquidity Provider</span>
              <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mt-4 mb-4">
                LP <span className="text-gradient">Dashboard</span>
              </h1>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Earn fees by providing liquidity for instant FAsset redemptions.
              </p>
            </div>
          </div>
        </div>
        <div className="max-w-4xl mx-auto px-4 py-12">
          <Card>
            <CardContent className="pt-12 pb-12">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <Wallet className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Connect Your Wallet</h3>
                <p className="text-gray-500">Please connect your wallet to manage LP positions.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <Header />

      {/* Hero Section */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-12 sm:py-16">
          <div className="text-center">
            <span className="section-label">Liquidity Provider</span>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mt-4 mb-4">
              LP <span className="text-gradient">Dashboard</span>
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Earn haircut fees by providing liquidity for instant FAsset redemptions.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12 space-y-8">
        {/* Error Display */}
        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-700">Error</p>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
        )}

        {/* Success Message */}
        {txSuccess && (
          <div className="p-4 rounded-xl bg-green-50 border border-green-200 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-green-700">Transaction Successful</p>
              <a
                href={`${CONTRACTS.networks.coston2.explorer}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-green-600 hover:text-green-700 inline-flex items-center gap-1"
              >
                View on explorer <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        {/* Current Position */}
        {position && position.active && (
          <Card className="card-pink overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-flare-pink/10 to-transparent border-b border-flare-pink/10">
              <CardTitle className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-flare-pink/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-flare-pink" />
                </div>
                Your LP Position
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-white rounded-xl border border-gray-100">
                  <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                    <PiggyBank className="w-4 h-4" />
                    Deposited
                  </div>
                  <p className="text-2xl font-bold text-gray-900 number-display">
                    {formatUnits(position.depositedAmount, 18)}
                  </p>
                  <p className="text-sm text-gray-500">FLR</p>
                </div>
                <div className="p-4 bg-white rounded-xl border border-gray-100">
                  <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                    <Wallet className="w-4 h-4" />
                    Available
                  </div>
                  <p className="text-2xl font-bold text-gray-900 number-display">
                    {formatUnits(position.availableAmount, 18)}
                  </p>
                  <p className="text-sm text-gray-500">FLR</p>
                </div>
                <div className="p-4 bg-white rounded-xl border border-green-100 bg-green-50/50">
                  <div className="flex items-center gap-2 text-green-600 text-sm mb-1">
                    <TrendingUp className="w-4 h-4" />
                    Total Earned
                  </div>
                  <p className="text-2xl font-bold text-green-600 number-display">
                    {formatUnits(position.totalEarned, 18)}
                  </p>
                  <p className="text-sm text-green-600">FLR</p>
                </div>
                <div className="p-4 bg-white rounded-xl border border-gray-100">
                  <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                    <Percent className="w-4 h-4" />
                    Min Haircut
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {(Number(position.minHaircut) / 10000).toFixed(2)}%
                  </p>
                </div>
              </div>
              <div className="mt-4 p-4 bg-gray-50 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">Max Delay:</span>
                </div>
                <span className="font-semibold text-gray-900">{Number(position.maxDelay)} seconds</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Deposit Liquidity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-flare-pink/10 flex items-center justify-center">
                <PiggyBank className="w-5 h-5 text-flare-pink" />
              </div>
              Deposit Liquidity
            </CardTitle>
            <CardDescription>
              Provide FLR liquidity to earn haircut fees on fast-lane redemptions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Amount (FLR)
              </label>
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0.0"
                className="input-modern text-lg font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Minimum Haircut (%)
                </label>
                <input
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
                  className="input-modern"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Fee you earn per redemption
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Max Delay (seconds)
                </label>
                <input
                  type="number"
                  value={maxDelay}
                  onChange={(e) => setMaxDelay(e.target.value)}
                  placeholder="3600"
                  className="input-modern"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Max time before FDC confirmation
                </p>
              </div>
            </div>

            <Button
              onClick={handleDeposit}
              disabled={!depositAmount || isPending || isWaitingTx || loading}
              className="w-full"
              size="lg"
            >
              {isPending || isWaitingTx ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                'Deposit Liquidity'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Withdraw Liquidity */}
        {position && position.active && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                  <ArrowDownToLine className="w-5 h-5 text-gray-600" />
                </div>
                Withdraw Liquidity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Amount (FLR)
                </label>
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="0.0"
                  max={position.availableAmount ? formatUnits(position.availableAmount, 18) : undefined}
                  className="input-modern text-lg font-medium"
                />
                <div className="flex justify-between mt-2">
                  <p className="text-xs text-gray-500">
                    Available: {position.availableAmount ? formatUnits(position.availableAmount, 18) : '0'} FLR
                  </p>
                  <button
                    onClick={() => setWithdrawAmount(formatUnits(position.availableAmount, 18))}
                    className="text-xs text-flare-pink hover:text-flare-pink-dark font-semibold"
                  >
                    Max
                  </button>
                </div>
              </div>

              <Button
                onClick={handleWithdraw}
                disabled={!withdrawAmount || isPending || isWaitingTx || loading}
                className="w-full"
                size="lg"
                variant="outline"
              >
                {isPending || isWaitingTx ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Withdraw Liquidity'
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* How LP Works */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">How LP Earnings Work</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-flare-pink/5 border border-flare-pink/10">
                <p className="font-semibold text-gray-900 mb-2">Revenue Formula</p>
                <p className="text-sm text-gray-600">
                  <code className="bg-gray-100 px-2 py-1 rounded font-mono text-flare-pink">H ≥ r × T</code>
                  <br />
                  <span className="text-gray-500 mt-2 block">
                    Where H = haircut rate, r = opportunity cost rate, T = escrow time
                  </span>
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="font-semibold text-gray-900 mb-1">Example APY</p>
                  <p className="text-sm text-gray-600">
                    1% haircut at 600s escrow = ~3,650% APY
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="font-semibold text-gray-900 mb-1">Risk</p>
                  <p className="text-sm text-gray-600">
                    Earn haircut only if FDC confirms XRP delivery
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
