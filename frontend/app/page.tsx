'use client';

import { Header } from "@/components/header";
import { HeroSection } from "@/components/hero-section";
import { FeaturesSection } from "@/components/features-section";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0b0f1f] via-black to-black text-white selection:bg-purple-500/30">
      {/* Header */}
      <Header />
      
      {/* Hero Section with sticky background */}
      <HeroSection />
      
      {/* Features Section */}
      <FeaturesSection />

      {/* Footer with FDC message */}
      <footer className="bg-black/40 border-t border-gray-800/60 py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-gray-400 mb-4">
            🔒 <strong className="text-white">FDC is the final judge.</strong> FLIP only changes when users get paid.
          </p>
          <div className="flex justify-center gap-6 text-sm text-gray-500">
            <Link href="/status" className="hover:text-white transition">Status</Link>
            <Link href="/redeem" className="hover:text-white transition">Redeem</Link>
            <a href="https://coston2-explorer.flare.network" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">
              Explorer
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
