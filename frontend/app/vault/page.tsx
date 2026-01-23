'use client';

import { Header } from "@/components/header";
import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { parseEther, formatEther, Address } from 'viem';
import { CONTRACTS, BLAZE_VAULT_ABI } from '@/lib/contracts';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0b0f1f] via-black to-black">
        <Header />
        <div className="container mx-auto px-4 py-16">
          <Card className="bg-gray-900/60 border-gray-800 text-white">
            <CardContent className="pt-6">
              <p className="text-center text-gray-400">Please connect your wallet to access the vault</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Parse vault stats tuple
  const stats = vaultStats as [bigint, bigint, bigint, bigint, bigint, bigint, boolean] | undefined;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b0f1f] via-black to-black text-white">
      <Header />
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Page Header */}
          <Card className="bg-gray-900/60 border-gray-800 backdrop-blur-xl shadow-2xl shadow-purple-500/10">
            <CardHeader className="border-b border-gray-800/60 pb-6">
              <CardTitle className="text-3xl font-bold">BlazeSwap Vault</CardTitle>
              <CardDescription className="text-gray-400">
                Earn yield by providing backstop liquidity. Your FLR is deployed to FLIP and used for just-in-time settlements via BlazeSwap.
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Alerts */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/40 rounded-lg p-4">
              <p className="text-red-400">{error}</p>
            </div>
          )}
          {successMsg && (
            <div className="bg-green-500/10 border border-green-500/40 rounded-lg p-4">
              <p className="text-green-400">{successMsg}</p>
              {txHash && (
                <a
                  href={`${CONTRACTS.networks.coston2.explorer}/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-400 hover:underline"
                >
                  View on explorer
                </a>
              )}
            </div>
          )}

          {/* Vault Stats */}
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="text-xl">Vault Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-800/40 rounded-lg p-4">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Total Assets</p>
                  <p className="text-lg font-bold mt-1">
                    {stats ? formatEther(stats[0]) : '0'} FLR
                  </p>
                </div>
                <div className="bg-gray-800/40 rounded-lg p-4">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Deployed to FLIP</p>
                  <p className="text-lg font-bold mt-1">
                    {stats ? formatEther(stats[2]) : '0'} FLR
                  </p>
                </div>
                <div className="bg-gray-800/40 rounded-lg p-4">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Idle Balance</p>
                  <p className="text-lg font-bold mt-1">
                    {stats ? formatEther(stats[4]) : '0'} FLR
                  </p>
                </div>
                <div className="bg-gray-800/40 rounded-lg p-4">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Share Price</p>
                  <p className="text-lg font-bold mt-1">
                    {sharePrice ? Number(formatEther(sharePrice as bigint)).toFixed(4) : '1.0000'} FLR
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                <div className="bg-gray-800/40 rounded-lg p-4">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Total Shares</p>
                  <p className="text-lg font-bold mt-1">
                    {stats ? formatEther(stats[1]) : '0'}
                  </p>
                </div>
                <div className="bg-gray-800/40 rounded-lg p-4">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Total Haircuts Earned</p>
                  <p className="text-lg font-bold mt-1 text-green-400">
                    {totalHaircuts ? formatEther(totalHaircuts as bigint) : '0'} FLR
                  </p>
                </div>
                <div className="bg-gray-800/40 rounded-lg p-4">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Backstop</p>
                  <p className="text-lg font-bold mt-1">
                    <span className={backstopEnabled ? 'text-green-400' : 'text-red-400'}>
                      {backstopEnabled ? 'Active' : 'Paused'}
                    </span>
                  </p>
                </div>
              </div>

              {stats && stats[6] && (
                <div className="mt-4 flex items-center justify-between bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                  <p className="text-yellow-400 text-sm">Vault allocation has drifted from target. Rebalance available.</p>
                  <Button
                    onClick={handleRebalance}
                    disabled={isPending || isWaitingTx}
                    className="bg-yellow-600 hover:bg-yellow-500 text-black font-semibold text-sm px-4 py-2"
                    size="sm"
                  >
                    {isPending || isWaitingTx ? 'Processing...' : 'Rebalance'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* User Position */}
          {userShares && (userShares as bigint) > BigInt(0) && (
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="text-xl">Your Position</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-800/40 rounded-lg p-4">
                    <p className="text-xs text-gray-400 uppercase tracking-wider">Your Shares</p>
                    <p className="text-lg font-bold mt-1">
                      {formatEther(userShares as bigint)}
                    </p>
                  </div>
                  <div className="bg-gray-800/40 rounded-lg p-4">
                    <p className="text-xs text-gray-400 uppercase tracking-wider">Underlying Value</p>
                    <p className="text-lg font-bold mt-1">
                      {userUnderlying ? formatEther(userUnderlying as bigint) : '0'} FLR
                    </p>
                  </div>
                  <div className="bg-gray-800/40 rounded-lg p-4">
                    <p className="text-xs text-gray-400 uppercase tracking-wider">Pending Earnings</p>
                    <p className="text-lg font-bold mt-1 text-green-400">
                      {pendingEarnings ? formatEther(pendingEarnings as bigint) : '0'} FLR
                    </p>
                  </div>
                  <div className="bg-gray-800/40 rounded-lg p-4">
                    <p className="text-xs text-gray-400 uppercase tracking-wider">Lockup</p>
                    <p className={`text-lg font-bold mt-1 ${isLocked() ? 'text-yellow-400' : 'text-green-400'}`}>
                      {getUnlockTime()}
                    </p>
                  </div>
                </div>

                {/* Claim Earnings */}
                {pendingEarnings && (pendingEarnings as bigint) > BigInt(0) && (
                  <Button
                    onClick={handleClaimEarnings}
                    disabled={isPending || isWaitingTx}
                    className="w-full h-10 font-semibold bg-green-600 hover:bg-green-500"
                  >
                    {isPending || isWaitingTx ? 'Processing...' : `Claim ${formatEther(pendingEarnings as bigint)} FLR Earnings`}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Deposit */}
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="text-xl">Deposit FLR</CardTitle>
              <CardDescription className="text-gray-400">
                Deposit FLR to receive vault shares. Your funds are deployed as backstop liquidity and earn haircut fees.
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
                  min="0"
                  step="0.1"
                  className="bg-gray-800/50 border-gray-700 h-12 focus:ring-purple-500 focus:border-purple-500"
                />
                {depositAmount && sharePrice && (
                  <p className="text-xs text-gray-400 mt-1">
                    You will receive ~{(Number(depositAmount) / Number(formatEther(sharePrice as bigint))).toFixed(4)} shares
                  </p>
                )}
              </div>
              <Button
                onClick={handleDeposit}
                disabled={!depositAmount || Number(depositAmount) <= 0 || isPending || isWaitingTx}
                className="w-full h-12 text-base font-bold bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 shadow-lg shadow-purple-500/20"
              >
                {isPending || isWaitingTx ? 'Processing...' : 'Deposit to Vault'}
              </Button>
            </CardContent>
          </Card>

          {/* Withdraw */}
          {userShares && (userShares as bigint) > BigInt(0) && (
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="text-xl">Withdraw</CardTitle>
                <CardDescription className="text-gray-400">
                  Burn shares to receive FLR back. Subject to lockup period.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-gray-300 text-sm uppercase tracking-wider font-semibold">Shares to Burn</Label>
                  <Input
                    type="number"
                    value={withdrawShares}
                    onChange={(e) => setWithdrawShares(e.target.value)}
                    placeholder="0.0"
                    min="0"
                    step="0.1"
                    className="bg-gray-800/50 border-gray-700 h-12 focus:ring-purple-500 focus:border-purple-500"
                  />
                  <div className="flex justify-between mt-1">
                    <p className="text-xs text-gray-400">
                      Available: {formatEther(userShares as bigint)} shares
                    </p>
                    <button
                      onClick={() => setWithdrawShares(formatEther(userShares as bigint))}
                      className="text-xs text-purple-400 hover:text-purple-300"
                    >
                      Max
                    </button>
                  </div>
                  {withdrawShares && sharePrice && (
                    <p className="text-xs text-gray-400 mt-1">
                      You will receive ~{(Number(withdrawShares) * Number(formatEther(sharePrice as bigint))).toFixed(4)} FLR
                    </p>
                  )}
                </div>
                <Button
                  onClick={handleWithdraw}
                  disabled={!withdrawShares || Number(withdrawShares) <= 0 || isPending || isWaitingTx || isLocked()}
                  className="w-full h-12 text-base font-semibold border-purple-500/40 text-purple-300 hover:text-white hover:border-purple-400"
                  variant="outline"
                >
                  {isLocked()
                    ? `Locked (${getUnlockTime()})`
                    : isPending || isWaitingTx
                      ? 'Processing...'
                      : 'Withdraw from Vault'}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Info Card */}
          <Card className="bg-gray-900/30 border-gray-800/50">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-400">
                <div>
                  <p className="font-semibold text-gray-300 mb-1">How it works</p>
                  <p>Deposited FLR is split between idle reserves and FLIP LP positions. When no direct LP matches a redemption, the vault provides just-in-time liquidity via BlazeSwap.</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-300 mb-1">Earnings</p>
                  <p>Vault depositors earn a share of haircut fees from every backstop settlement, proportional to their vault shares.</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-300 mb-1">Risks</p>
                  <p>Funds may be temporarily locked in FLIP escrow. Slippage on BlazeSwap swaps. Anti-flashloan lockup applies to deposits.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
