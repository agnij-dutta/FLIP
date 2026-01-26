'use client';

import { Header } from "@/components/header";
import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { parseEther, formatEther, Address } from 'viem';
import { CONTRACTS, BLAZE_VAULT_ABI } from '@/lib/contracts';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Vault, TrendingUp, Clock, AlertCircle, CheckCircle, Loader2, ExternalLink, PiggyBank, ArrowDownToLine, RefreshCw, Wallet } from "lucide-react";

const VAULT_ADDRESS = CONTRACTS.coston2.BlazeFLIPVault as Address;

export default function VaultDashboard() {
  const { address, isConnected } = useAccount();
  const { writeContract, data: txHash, isPending, reset } = useWriteContract();
  const { isLoading: isWaitingTx, isSuccess: txSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawShares, setWithdrawShares] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Read vault stats
  const { data: vaultStats, refetch: refetchStats } = useReadContract({
    address: VAULT_ADDRESS,
    abi: BLAZE_VAULT_ABI,
    functionName: 'getVaultStats',
    query: { enabled: isConnected },
  });

  // Read user shares
  const { data: userShares, refetch: refetchShares } = useReadContract({
    address: VAULT_ADDRESS,
    abi: BLAZE_VAULT_ABI,
    functionName: 'shares',
    args: address ? [address] : undefined,
    query: { enabled: !!address && isConnected },
  });

  // Read user underlying balance
  const { data: userUnderlying, refetch: refetchUnderlying } = useReadContract({
    address: VAULT_ADDRESS,
    abi: BLAZE_VAULT_ABI,
    functionName: 'balanceOfUnderlying',
    args: address ? [address] : undefined,
    query: { enabled: !!address && isConnected },
  });

  // Read pending earnings
  const { data: pendingEarnings, refetch: refetchEarnings } = useReadContract({
    address: VAULT_ADDRESS,
    abi: BLAZE_VAULT_ABI,
    functionName: 'getPendingEarnings',
    args: address ? [address] : undefined,
    query: { enabled: !!address && isConnected },
  });

  // Read share price
  const { data: sharePrice } = useReadContract({
    address: VAULT_ADDRESS,
    abi: BLAZE_VAULT_ABI,
    functionName: 'sharePrice',
    query: { enabled: isConnected },
  });

  // Read deposit timestamp
  const { data: depositTimestamp } = useReadContract({
    address: VAULT_ADDRESS,
    abi: BLAZE_VAULT_ABI,
    functionName: 'depositTimestamp',
    args: address ? [address] : undefined,
    query: { enabled: !!address && isConnected },
  });

  // Read min deposit delay
  const { data: minDepositDelay } = useReadContract({
    address: VAULT_ADDRESS,
    abi: BLAZE_VAULT_ABI,
    functionName: 'minDepositDelay',
    query: { enabled: isConnected },
  });

  // Read backstop status
  const { data: backstopEnabled } = useReadContract({
    address: VAULT_ADDRESS,
    abi: BLAZE_VAULT_ABI,
    functionName: 'backstopEnabled',
    query: { enabled: isConnected },
  });

  // Read total haircuts earned
  const { data: totalHaircuts } = useReadContract({
    address: VAULT_ADDRESS,
    abi: BLAZE_VAULT_ABI,
    functionName: 'totalHaircutsEarned',
    query: { enabled: isConnected },
  });

  // Refetch after tx success
  useEffect(() => {
    if (txSuccess) {
      refetchStats();
      refetchShares();
      refetchUnderlying();
      refetchEarnings();
      setDepositAmount('');
      setWithdrawShares('');
      setSuccessMsg('Transaction successful!');
      setTimeout(() => setSuccessMsg(null), 5000);
    }
  }, [txSuccess, refetchStats, refetchShares, refetchUnderlying, refetchEarnings]);

  const handleDeposit = async () => {
    if (!depositAmount || !isConnected) return;
    try {
      setError(null);
      reset();
      const amountWei = parseEther(depositAmount);
      writeContract({
        address: VAULT_ADDRESS,
        abi: BLAZE_VAULT_ABI,
        functionName: 'deposit',
        value: amountWei,
      });
    } catch (err: any) {
      setError(`Deposit failed: ${err.message}`);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawShares || !isConnected) return;
    try {
      setError(null);
      reset();
      const sharesWei = parseEther(withdrawShares);
      writeContract({
        address: VAULT_ADDRESS,
        abi: BLAZE_VAULT_ABI,
        functionName: 'withdraw',
        args: [sharesWei],
      });
    } catch (err: any) {
      setError(`Withdraw failed: ${err.message}`);
    }
  };

  const handleClaimEarnings = async () => {
    if (!isConnected) return;
    try {
      setError(null);
      reset();
      writeContract({
        address: VAULT_ADDRESS,
        abi: BLAZE_VAULT_ABI,
        functionName: 'claimEarnings',
      });
    } catch (err: any) {
      setError(`Claim failed: ${err.message}`);
    }
  };

  const handleRebalance = async () => {
    if (!isConnected) return;
    try {
      setError(null);
      reset();
      writeContract({
        address: VAULT_ADDRESS,
        abi: BLAZE_VAULT_ABI,
        functionName: 'rebalance',
      });
    } catch (err: any) {
      setError(`Rebalance failed: ${err.message}`);
    }
  };

  const isLocked = (): boolean => {
    if (!depositTimestamp || !minDepositDelay) return false;
    const unlockTime = Number(depositTimestamp) + Number(minDepositDelay);
    return Math.floor(Date.now() / 1000) < unlockTime;
  };

  const getUnlockTime = (): string => {
    if (!depositTimestamp || !minDepositDelay) return '';
    const unlockTime = Number(depositTimestamp) + Number(minDepositDelay);
    const now = Math.floor(Date.now() / 1000);
    if (now >= unlockTime) return 'Unlocked';
    const remaining = unlockTime - now;
    if (remaining > 3600) return `${Math.floor(remaining / 3600)}h ${Math.floor((remaining % 3600) / 60)}m`;
    return `${Math.floor(remaining / 60)}m ${remaining % 60}s`;
  };

  // Parse vault stats tuple
  const stats = vaultStats as [bigint, bigint, bigint, bigint, bigint, bigint, boolean] | undefined;

  if (!isConnected) {
    return (
      <main className="min-h-screen bg-gray-50">
        <Header />
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-4xl mx-auto px-4 py-12 sm:py-16">
            <div className="text-center">
              <span className="section-label">BlazeSwap Integration</span>
              <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mt-4 mb-4">
                FLIP <span className="text-gradient">Vault</span>
              </h1>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Earn yield by providing backstop liquidity for just-in-time settlements.
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
                <p className="text-gray-500">Please connect your wallet to access the vault.</p>
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
            <span className="section-label">BlazeSwap Integration</span>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mt-4 mb-4">
              FLIP <span className="text-gradient">Vault</span>
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Earn yield by providing backstop liquidity. Your FLR is deployed for just-in-time settlements via BlazeSwap.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12 space-y-8">
        {/* Alerts */}
        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-700">Error</p>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-xl bg-green-50 border border-green-200 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-green-700">{successMsg}</p>
              {txHash && (
                <a
                  href={`${CONTRACTS.networks.coston2.explorer}/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-green-600 hover:text-green-700 inline-flex items-center gap-1"
                >
                  View on explorer <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* Vault Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-flare-pink/10 flex items-center justify-center">
                <Vault className="w-5 h-5 text-flare-pink" />
              </div>
              Vault Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Assets</p>
                <p className="text-2xl font-bold text-gray-900 number-display">
                  {stats ? Number(formatEther(stats[0])).toLocaleString(undefined, {maximumFractionDigits: 2}) : '0'}
                </p>
                <p className="text-sm text-gray-500">FLR</p>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Deployed to FLIP</p>
                <p className="text-2xl font-bold text-gray-900 number-display">
                  {stats ? Number(formatEther(stats[2])).toLocaleString(undefined, {maximumFractionDigits: 2}) : '0'}
                </p>
                <p className="text-sm text-gray-500">FLR</p>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Idle Balance</p>
                <p className="text-2xl font-bold text-gray-900 number-display">
                  {stats ? Number(formatEther(stats[4])).toLocaleString(undefined, {maximumFractionDigits: 2}) : '0'}
                </p>
                <p className="text-sm text-gray-500">FLR</p>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Share Price</p>
                <p className="text-2xl font-bold text-gray-900 number-display">
                  {sharePrice ? Number(formatEther(sharePrice as bigint)).toFixed(4) : '1.0000'}
                </p>
                <p className="text-sm text-gray-500">FLR</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Shares</p>
                <p className="text-lg font-bold text-gray-900 number-display">
                  {stats ? Number(formatEther(stats[1])).toLocaleString(undefined, {maximumFractionDigits: 2}) : '0'}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-green-50 border border-green-100">
                <p className="text-xs text-green-600 uppercase tracking-wider mb-1">Total Haircuts Earned</p>
                <p className="text-lg font-bold text-green-600 number-display">
                  {totalHaircuts ? Number(formatEther(totalHaircuts as bigint)).toLocaleString(undefined, {maximumFractionDigits: 4}) : '0'} FLR
                </p>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Backstop</p>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${backstopEnabled ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className={`font-bold ${backstopEnabled ? 'text-green-600' : 'text-red-600'}`}>
                    {backstopEnabled ? 'Active' : 'Paused'}
                  </span>
                </div>
              </div>
            </div>

            {stats && stats[6] && (
              <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <RefreshCw className="w-5 h-5 text-amber-600" />
                  <p className="text-sm text-amber-700">Vault allocation has drifted from target. Rebalance available.</p>
                </div>
                <Button
                  onClick={handleRebalance}
                  disabled={isPending || isWaitingTx}
                  size="sm"
                  className="bg-amber-500 hover:bg-amber-600"
                >
                  {isPending || isWaitingTx ? 'Processing...' : 'Rebalance'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* User Position */}
        {userShares && (userShares as bigint) > BigInt(0) && (
          <Card className="card-pink overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-flare-pink/10 to-transparent border-b border-flare-pink/10">
              <CardTitle className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-flare-pink/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-flare-pink" />
                </div>
                Your Position
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-white rounded-xl border border-gray-100">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Your Shares</p>
                  <p className="text-2xl font-bold text-gray-900 number-display">
                    {Number(formatEther(userShares as bigint)).toLocaleString(undefined, {maximumFractionDigits: 4})}
                  </p>
                </div>
                <div className="p-4 bg-white rounded-xl border border-gray-100">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Underlying Value</p>
                  <p className="text-2xl font-bold text-gray-900 number-display">
                    {userUnderlying ? Number(formatEther(userUnderlying as bigint)).toLocaleString(undefined, {maximumFractionDigits: 4}) : '0'}
                  </p>
                  <p className="text-sm text-gray-500">FLR</p>
                </div>
                <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                  <p className="text-xs text-green-600 uppercase tracking-wider mb-1">Pending Earnings</p>
                  <p className="text-2xl font-bold text-green-600 number-display">
                    {pendingEarnings ? Number(formatEther(pendingEarnings as bigint)).toLocaleString(undefined, {maximumFractionDigits: 4}) : '0'}
                  </p>
                  <p className="text-sm text-green-600">FLR</p>
                </div>
                <div className="p-4 bg-white rounded-xl border border-gray-100">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Lockup</p>
                  <p className={`text-2xl font-bold ${isLocked() ? 'text-amber-500' : 'text-green-500'}`}>
                    {getUnlockTime()}
                  </p>
                </div>
              </div>

              {pendingEarnings && (pendingEarnings as bigint) > BigInt(0) && (
                <Button
                  onClick={handleClaimEarnings}
                  disabled={isPending || isWaitingTx}
                  className="w-full mt-4 bg-green-600 hover:bg-green-700"
                  size="lg"
                >
                  {isPending || isWaitingTx ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    `Claim ${Number(formatEther(pendingEarnings as bigint)).toLocaleString(undefined, {maximumFractionDigits: 4})} FLR Earnings`
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Deposit */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-flare-pink/10 flex items-center justify-center">
                <PiggyBank className="w-5 h-5 text-flare-pink" />
              </div>
              Deposit FLR
            </CardTitle>
            <CardDescription>
              Deposit FLR to receive vault shares. Your funds are deployed as backstop liquidity and earn haircut fees.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Amount (FLR)</label>
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0.0"
                min="0"
                step="0.1"
                className="input-modern text-lg font-medium"
              />
              {depositAmount && sharePrice && (
                <p className="text-xs text-gray-500 mt-2">
                  You will receive ~{(Number(depositAmount) / Number(formatEther(sharePrice as bigint))).toFixed(4)} shares
                </p>
              )}
            </div>
            <Button
              onClick={handleDeposit}
              disabled={!depositAmount || Number(depositAmount) <= 0 || isPending || isWaitingTx}
              className="w-full"
              size="lg"
            >
              {isPending || isWaitingTx ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                'Deposit to Vault'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Withdraw */}
        {userShares && (userShares as bigint) > BigInt(0) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                  <ArrowDownToLine className="w-5 h-5 text-gray-600" />
                </div>
                Withdraw
              </CardTitle>
              <CardDescription>
                Burn shares to receive FLR back. Subject to lockup period.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Shares to Burn</label>
                <input
                  type="number"
                  value={withdrawShares}
                  onChange={(e) => setWithdrawShares(e.target.value)}
                  placeholder="0.0"
                  min="0"
                  step="0.1"
                  className="input-modern text-lg font-medium"
                />
                <div className="flex justify-between mt-2">
                  <p className="text-xs text-gray-500">
                    Available: {Number(formatEther(userShares as bigint)).toLocaleString(undefined, {maximumFractionDigits: 4})} shares
                  </p>
                  <button
                    onClick={() => setWithdrawShares(formatEther(userShares as bigint))}
                    className="text-xs text-flare-pink hover:text-flare-pink-dark font-semibold"
                  >
                    Max
                  </button>
                </div>
                {withdrawShares && sharePrice && (
                  <p className="text-xs text-gray-500 mt-1">
                    You will receive ~{(Number(withdrawShares) * Number(formatEther(sharePrice as bigint))).toFixed(4)} FLR
                  </p>
                )}
              </div>
              <Button
                onClick={handleWithdraw}
                disabled={!withdrawShares || Number(withdrawShares) <= 0 || isPending || isWaitingTx || isLocked()}
                className="w-full"
                size="lg"
                variant="outline"
              >
                {isLocked() ? (
                  <>
                    <Clock className="w-5 h-5 mr-2" />
                    Locked ({getUnlockTime()})
                  </>
                ) : isPending || isWaitingTx ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Withdraw from Vault'
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Info Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 rounded-xl bg-gray-50">
                <p className="font-semibold text-gray-900 mb-2">How it works</p>
                <p className="text-sm text-gray-600">
                  Deposited FLR is split between idle reserves and FLIP LP positions. When no direct LP matches a redemption, the vault provides just-in-time liquidity via BlazeSwap.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-gray-50">
                <p className="font-semibold text-gray-900 mb-2">Earnings</p>
                <p className="text-sm text-gray-600">
                  Vault depositors earn a share of haircut fees from every backstop settlement, proportional to their vault shares.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-gray-50">
                <p className="font-semibold text-gray-900 mb-2">Risks</p>
                <p className="text-sm text-gray-600">
                  Funds may be temporarily locked in FLIP escrow. Slippage on BlazeSwap swaps. Anti-flashloan lockup applies to deposits.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
