'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useState } from 'react';
import { parseEther, formatEther } from 'viem';

// Contract addresses (update these after deployment)
const FLIP_CORE_ADDRESS = '0x0000000000000000000000000000000000000000'; // Update after deployment
const FASSET_ADDRESS = '0x0000000000000000000000000000000000000000'; // Update after deployment

// ABI snippets (simplified - use full ABI from artifacts)
const FLIP_CORE_ABI = [
  {
    inputs: [
      { name: '_amount', type: 'uint256' },
      { name: '_asset', type: 'address' },
    ],
    name: 'requestRedemption',
    outputs: [{ name: 'redemptionId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: '_redemptionId', type: 'uint256' }],
    name: 'getRedemptionStatus',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const STATUS_NAMES = [
  'Pending',
  'QueuedForFDC',
  'ProvisionallySettled',
  'Finalized',
  'Failed',
  'InsuranceClaimed',
];

export default function Home() {
  const { address, isConnected } = useAccount();
  const [amount, setAmount] = useState('');
  const [redemptionId, setRedemptionId] = useState<bigint | null>(null);

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const { data: status } = useReadContract({
    address: FLIP_CORE_ADDRESS,
    abi: FLIP_CORE_ABI,
    functionName: 'getRedemptionStatus',
    args: redemptionId !== null ? [redemptionId] : undefined,
    query: {
      enabled: redemptionId !== null && FLIP_CORE_ADDRESS !== '0x0000000000000000000000000000000000000000',
    },
  });

  const handleRequestRedemption = async () => {
    if (!amount || !isConnected) return;

    try {
      const amountWei = parseEther(amount);
      const txHash = await writeContract({
        address: FLIP_CORE_ADDRESS,
        abi: FLIP_CORE_ABI,
        functionName: 'requestRedemption',
        args: [amountWei, FASSET_ADDRESS],
      });
      // In a real app, parse the transaction receipt to get redemptionId
      console.log('Transaction hash:', txHash);
    } catch (error) {
      console.error('Error requesting redemption:', error);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-flare-primary to-flare-secondary bg-clip-text text-transparent">
              FLIP Protocol
            </h1>
            <p className="text-gray-400 mt-2">Flare Liquidation Insurance Protocol</p>
          </div>
          <ConnectButton />
        </div>

        <div className="max-w-2xl mx-auto">
          <div className="bg-gray-800 rounded-lg p-6 shadow-xl border border-gray-700">
            <h2 className="text-2xl font-semibold mb-4">Request Redemption</h2>
            
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
                    className="w-full px-4 py-2 bg-gray-700 rounded-lg border border-gray-600 focus:border-flare-primary focus:outline-none"
                  />
                </div>

                <button
                  onClick={handleRequestRedemption}
                  disabled={!amount || isPending || isConfirming}
                  className="w-full bg-gradient-to-r from-flare-primary to-flare-secondary text-white font-semibold py-3 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {isPending ? 'Requesting...' : isConfirming ? 'Confirming...' : 'Request Redemption'}
                </button>

                {isSuccess && (
                  <div className="mt-4 p-4 bg-green-900/30 border border-green-700 rounded-lg">
                    <p className="text-green-400">Redemption requested successfully!</p>
                    <p className="text-sm text-gray-400 mt-2">Transaction: {hash}</p>
                  </div>
                )}

                {redemptionId !== null && status !== undefined && (
                  <div className="mt-4 p-4 bg-blue-900/30 border border-blue-700 rounded-lg">
                    <p className="text-blue-400">Redemption Status</p>
                    <p className="text-sm text-gray-300 mt-2">
                      ID: {redemptionId.toString()}
                    </p>
                    <p className="text-sm text-gray-300">
                      Status: {STATUS_NAMES[Number(status)] || 'Unknown'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-lg font-semibold mb-2">Instant Settlement</h3>
              <p className="text-gray-400 text-sm">
                Get instant redemption with high-confidence scoring
              </p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-lg font-semibold mb-2">Insurance Backed</h3>
              <p className="text-gray-400 text-sm">
                Protected by the Settlement Guarantee Pool
              </p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-lg font-semibold mb-2">Deterministic Scoring</h3>
              <p className="text-gray-400 text-sm">
                Transparent, on-chain decision making
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}



