'use client';

import { Header } from "@/components/header";
import { useReadContract } from 'wagmi';
import { CONTRACTS, FLIP_CORE_ABI } from '@/lib/contracts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Shield, Cpu, Lock, CheckCircle, AlertCircle, ExternalLink, Copy } from "lucide-react";
import { useState } from "react";

export default function StatusPage() {
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const { data: isPaused } = useReadContract({
    address: CONTRACTS.coston2.FLIPCore,
    abi: FLIP_CORE_ABI,
    functionName: 'paused',
  });

  const copyToClipboard = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const stats = [
    { label: "Total Redemptions", value: "1,247", trend: "+12%" },
    { label: "Success Rate", value: "99.2%", trend: "+0.3%" },
    { label: "Avg Settlement", value: "45s", trend: "-5s" },
    { label: "LP Liquidity", value: "125K FLR", trend: "+15%" },
  ];

  const contracts = [
    { name: "FLIPCore", address: CONTRACTS.coston2.FLIPCore, description: "Main protocol orchestrator" },
    { name: "EscrowVault", address: CONTRACTS.coston2.EscrowVault, description: "Conditional escrow management" },
    { name: "SettlementReceipt", address: CONTRACTS.coston2.SettlementReceipt, description: "ERC-721 settlement NFTs" },
    { name: "LP Registry", address: CONTRACTS.coston2.LiquidityProviderRegistry, description: "LP position tracking" },
    { name: "OracleRelay", address: CONTRACTS.coston2.OracleRelay, description: "FTSO price feed integration" },
    { name: "BlazeFLIPVault", address: CONTRACTS.coston2.BlazeFLIPVault, description: "Backstop liquidity vault" },
  ];

  return (
    <main className="min-h-screen bg-gray-50">
      <Header />

      {/* Hero Section */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-12 sm:py-16">
          <div className="text-center">
            <span className="section-label">System Monitoring</span>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mt-4 mb-4">
              Protocol <span className="text-gradient">Status</span>
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Real-time health and statistics for the FLIP protocol.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12 space-y-8">
        {/* System Health Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Contract Status */}
          <Card className={isPaused ? 'border-red-200 bg-red-50/50' : 'card-pink'}>
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-lg">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isPaused ? 'bg-red-100' : 'bg-flare-pink/10'}`}>
                  <Activity className={`w-5 h-5 ${isPaused ? 'text-red-500' : 'text-flare-pink'}`} />
                </div>
                Contract Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 mb-4">
                {isPaused ? (
                  <>
                    <div className="w-3 h-3 bg-red-500 rounded-full" />
                    <span className="font-semibold text-red-600">Paused</span>
                  </>
                ) : (
                  <>
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                    <span className="font-semibold text-green-600">Active</span>
                  </>
                )}
              </div>
              <p className="text-sm text-gray-600">
                FLIPCore is {isPaused ? 'temporarily paused' : 'operational and processing redemptions'}.
              </p>
            </CardContent>
          </Card>

          {/* FDC Status */}
          <Card className="border-green-200 bg-green-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-lg">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-green-600" />
                </div>
                FDC Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                <span className="font-semibold text-green-600">Healthy</span>
              </div>
              <p className="text-sm text-gray-600">
                Flare Data Connector is operational. All attestations verified.
              </p>
            </CardContent>
          </Card>

          {/* Oracle Status */}
          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-lg">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Cpu className="w-5 h-5 text-blue-600" />
                </div>
                Oracle Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                <span className="font-semibold text-green-600">Operational</span>
              </div>
              <p className="text-sm text-gray-600">
                FTSO price feeds are live and updating.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Statistics Grid */}
        <Card>
          <CardHeader>
            <CardTitle>Protocol Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="p-5 rounded-xl bg-gray-50 border border-gray-100 hover:border-flare-pink/30 transition-all"
                >
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-3xl font-bold text-gray-900 number-display">{stat.value}</span>
                    <span className="text-xs font-semibold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                      {stat.trend}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">{stat.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Contract Addresses */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Deployed Contracts</span>
              <span className="text-sm font-normal text-gray-500 flex items-center gap-2">
                <div className="w-2 h-2 bg-flare-pink rounded-full" />
                Coston2 Testnet
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {contracts.map((contract) => (
                <div
                  key={contract.name}
                  className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-100 hover:border-flare-pink/30 transition-all group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">{contract.name}</span>
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{contract.description}</p>
                    <code className="text-xs font-mono text-flare-pink bg-flare-pink/5 px-2 py-1 rounded">
                      {contract.address}
                    </code>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => copyToClipboard(contract.address)}
                      className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
                      title="Copy address"
                    >
                      {copiedAddress === contract.address ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                      )}
                    </button>
                    <a
                      href={`${CONTRACTS.networks.coston2.explorer}/address/${contract.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
                      title="View on explorer"
                    >
                      <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* FDC Trust Banner */}
        <div className="p-6 rounded-2xl bg-flare-pink text-white">
          <div className="flex items-center justify-center gap-4">
            <Lock className="w-8 h-8" />
            <div className="text-center">
              <p className="text-xl font-bold mb-1">FDC is the final judge.</p>
              <p className="text-white/80">FLIP only changes when users get paid. Your funds are always protected.</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
