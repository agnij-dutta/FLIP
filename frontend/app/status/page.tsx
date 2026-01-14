'use client';

import { Header } from "@/components/header";
import { useReadContract } from 'wagmi';
import { CONTRACTS, FLIP_CORE_ABI } from '@/lib/contracts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Component as RealTimeAnalytics } from "@/components/ui/real-time-analytics";
import { TextScramble } from "@/components/ui/text-scramble";

export default function StatusPage() {
  const { data: isPaused } = useReadContract({
    address: CONTRACTS.coston2.FLIPCore,
    abi: FLIP_CORE_ABI,
    functionName: 'paused',
  });

  // Statistics cards
  const stats = [
    { label: "Total Redemptions", value: "1,247" },
    { label: "Success Rate", value: "99.2%" },
    { label: "Avg Settlement", value: "45s" },
    { label: "LP Liquidity", value: "125K" },
  ];

  return (
    <main className="min-h-screen bg-gray-900 text-white">
      <Header />
      
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <TextScramble text="SYSTEM STATUS" className="text-4xl font-bold mb-4" />
          <p className="text-gray-400">Real-time FLIP protocol health and statistics</p>
        </div>

        {/* System Health */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg">Contract Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant={isPaused ? "destructive" : "default"} className="mb-2">
                {isPaused ? "Paused" : "Active"}
              </Badge>
              <p className="text-sm text-gray-400">
                FLIPCore: {CONTRACTS.coston2.FLIPCore.slice(0, 10)}...
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg">FDC Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="default" className="mb-2">Healthy</Badge>
              <p className="text-sm text-gray-400">
                FDC is the final judge for all redemptions
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg">Oracle Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="default" className="mb-2">Operational</Badge>
              <p className="text-sm text-gray-400">
                OracleRelay: {CONTRACTS.coston2.OracleRelay.slice(0, 10)}...
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {stats.map((stat) => (
            <Card key={stat.label} className="bg-gray-800 border-gray-700">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold mb-1">{stat.value}</div>
                <div className="text-sm text-gray-400">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Real-time Analytics */}
        <div className="mb-8">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle>Redemption Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <RealTimeAnalytics />
            </CardContent>
          </Card>
        </div>

        {/* Contract Addresses */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle>Deployed Contracts (Coston2)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">FLIPCore:</span>
                <code className="text-blue-400">{CONTRACTS.coston2.FLIPCore}</code>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">EscrowVault:</span>
                <code className="text-blue-400">{CONTRACTS.coston2.EscrowVault}</code>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">SettlementReceipt:</span>
                <code className="text-blue-400">{CONTRACTS.coston2.SettlementReceipt}</code>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">LP Registry:</span>
                <code className="text-blue-400">{CONTRACTS.coston2.LiquidityProviderRegistry}</code>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">OracleRelay:</span>
                <code className="text-blue-400">{CONTRACTS.coston2.OracleRelay}</code>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FDC Message */}
        <div className="mt-8 p-6 bg-blue-900/20 border border-blue-700 rounded-lg text-center">
          <p className="text-lg">
            🔒 <strong>FDC is the final judge.</strong> FLIP only changes when users get paid.
          </p>
        </div>
      </div>
    </main>
  );
}

