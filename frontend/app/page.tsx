'use client';

import { Header } from "@/components/header";
import { HeroDitheringCard } from "@/components/ui/hero-dithering-card";
import { FeaturesSection } from "@/components/features-section";
import { StackedCircularFooter } from "@/components/ui/stacked-circular-footer";

export default function Home() {
  return (
    <main className="min-h-screen bg-white dark:bg-gray-950 relative">
      {/* Subtle noise texture overlay */}
      <div className="noise-overlay" />

      {/* Background gradient mesh */}
      <div className="fixed inset-0 gradient-mesh pointer-events-none" />

      {/* Header */}
      <Header />

      {/* Hero Section */}
      <HeroDitheringCard />

      {/* Features Section */}
      <FeaturesSection />

      {/* Premium Footer */}
      <StackedCircularFooter />
    </main>
  );
}
