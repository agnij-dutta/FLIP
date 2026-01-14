"use client";

import RadialOrbitalTimeline from "@/components/ui/radial-orbital-timeline";
import { Zap, Shield, DollarSign, Clock, Lock, TrendingUp } from "lucide-react";

const featuresData = [
  {
    id: 1,
    title: "Instant Redemption",
    date: "Step 1",
    content: "Request redemption and get instant provisional settlement when confidence is high (≥99.7%)",
    category: "Speed",
    icon: Zap,
    relatedIds: [2, 3],
    status: "completed" as const,
    energy: 95,
  },
  {
    id: 2,
    title: "Deterministic Scoring",
    date: "Step 2",
    content: "On-chain mathematical scoring replaces ML - transparent, auditable, and fast",
    category: "Transparency",
    icon: TrendingUp,
    relatedIds: [1, 3],
    status: "completed" as const,
    energy: 90,
  },
  {
    id: 3,
    title: "Escrow Protection",
    date: "Step 3",
    content: "Conditional escrow ensures funds are safe until FDC confirms - no prefunded pools needed",
    category: "Security",
    icon: Shield,
    relatedIds: [2, 4],
    status: "completed" as const,
    energy: 88,
  },
  {
    id: 4,
    title: "FDC Adjudication",
    date: "Step 4",
    content: "FDC is the final judge - all redemptions are verified by Flare Data Connector",
    category: "Trust",
    icon: Lock,
    relatedIds: [3, 5],
    status: "in-progress" as const,
    energy: 85,
  },
  {
    id: 5,
    title: "LP Market",
    date: "Step 5",
    content: "Optional liquidity providers enable fast settlement - opt-in, not forced",
    category: "Liquidity",
    icon: DollarSign,
    relatedIds: [4],
    status: "pending" as const,
    energy: 80,
  },
  {
    id: 6,
    title: "Fast Finalization",
    date: "Step 6",
    content: "Receive funds immediately with haircut, or wait for FDC for full amount",
    category: "Choice",
    icon: Clock,
    relatedIds: [5],
    status: "pending" as const,
    energy: 75,
  },
];

export function FeaturesSection() {
  return (
    <section className="py-20 bg-gray-900">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            How FLIP Works
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            A transparent, trust-minimized system for instant FAsset redemptions
          </p>
        </div>
        
        <div className="max-w-6xl mx-auto">
          <RadialOrbitalTimeline timelineData={featuresData} />
        </div>
      </div>
    </section>
  );
}

