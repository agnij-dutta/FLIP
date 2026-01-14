"use client";

import { TextScramble } from "@/components/ui/text-scramble";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      {/* Sticky background effect */}
      <div className="fixed inset-0 -z-10">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-pink-600/20 animate-pulse" />
        
        {/* Grid pattern */}
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: "50px 50px",
          }}
        />
        
        {/* Animated orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/30 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 container mx-auto px-4 text-center">
        <div className="mb-8">
          <TextScramble 
            text="INSTANT FASSET REDEMPTIONS" 
            className="text-4xl md:text-6xl font-bold mb-4"
          />
        </div>
        
        <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-2xl mx-auto">
          Redeem FAssets faster without skipping FDC
        </p>
        
        <div className="mb-8">
          <p className="text-lg text-gray-400 mb-6">
            🔒 <strong>FDC is the final judge.</strong> FLIP only changes when users get paid.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link href="/redeem">
            <Button size="lg" className="text-lg px-8 py-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
              Get Started
            </Button>
          </Link>
          <Link href="/status">
            <Button size="lg" variant="outline" className="text-lg px-8 py-6 border-2">
              View Status
            </Button>
          </Link>
        </div>

        {/* Key benefits */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 border border-white/20">
            <div className="text-3xl mb-2">⚡</div>
            <h3 className="text-xl font-semibold mb-2">Instant Settlement</h3>
            <p className="text-gray-300 text-sm">
              Get instant redemption with high-confidence scoring (vs 3-5 min wait)
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 border border-white/20">
            <div className="text-3xl mb-2">🔒</div>
            <h3 className="text-xl font-semibold mb-2">Trust-Minimized</h3>
            <p className="text-gray-300 text-sm">
              FDC adjudication ensures security without sacrificing speed
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 border border-white/20">
            <div className="text-3xl mb-2">💰</div>
            <h3 className="text-xl font-semibold mb-2">Capital Efficient</h3>
            <p className="text-gray-300 text-sm">
              No idle capital pools - escrow-based conditional settlement
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

