"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight, Zap, Shield, Clock } from "lucide-react";
import { useEffect, useState } from "react";

// Animated particle component
function Particle({ delay, size, left, top }: { delay: number; size: number; left: string; top: string }) {
  return (
    <div
      className="absolute rounded-full animate-float"
      style={{
        width: size,
        height: size,
        left,
        top,
        animationDelay: `${delay}s`,
        background: `radial-gradient(circle, rgba(227, 29, 101, ${0.2 + Math.random() * 0.3}) 0%, transparent 70%)`,
      }}
    />
  );
}

// Stats counter component
function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const duration = 2000;
    const steps = 60;
    const increment = target / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [target]);

  return (
    <span className="number-display">
      {count.toLocaleString()}{suffix}
    </span>
  );
}

export function HeroSection() {
  const stats = [
    { label: "Avg Settlement", value: "45", suffix: "s" },
    { label: "Success Rate", value: "99.7", suffix: "%" },
    { label: "Capital Efficiency", value: "10", suffix: "x" },
  ];

  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 gradient-bg" />
      <div className="absolute inset-0 grid-pattern opacity-50" />

      {/* Animated Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <Particle delay={0} size={300} left="10%" top="20%" />
        <Particle delay={1} size={200} left="70%" top="10%" />
        <Particle delay={2} size={250} left="80%" top="60%" />
        <Particle delay={0.5} size={180} left="5%" top="70%" />
        <Particle delay={1.5} size={220} left="60%" top="80%" />
      </div>

      {/* Abstract 3D-like decorative elements */}
      <div className="absolute right-0 top-1/4 w-1/2 h-1/2 pointer-events-none opacity-60">
        <div className="relative w-full h-full">
          {/* Sphere cluster - inspired by Flare's 3D visuals */}
          <div className="absolute right-10 top-10 w-32 h-32 rounded-full bg-gradient-to-br from-flare-pink/30 to-flare-pink-light/20 blur-sm animate-float" />
          <div className="absolute right-32 top-20 w-20 h-20 rounded-full bg-gradient-to-br from-flare-pink/40 to-transparent blur-sm animate-float" style={{ animationDelay: '-2s' }} />
          <div className="absolute right-20 top-40 w-16 h-16 rounded-full bg-gradient-to-br from-flare-pink/50 to-flare-pink-light/30 animate-float" style={{ animationDelay: '-1s' }} />
          <div className="absolute right-48 top-16 w-12 h-12 rounded-full bg-white shadow-lg animate-float" style={{ animationDelay: '-3s' }} />
          <div className="absolute right-24 top-60 w-10 h-10 rounded-full bg-gradient-to-br from-white to-gray-100 shadow-md animate-float" style={{ animationDelay: '-1.5s' }} />
          <div className="absolute right-56 top-44 w-8 h-8 rounded-full bg-flare-pink animate-float" style={{ animationDelay: '-2.5s' }} />
          <div className="absolute right-40 top-72 w-14 h-14 rounded-full bg-gradient-to-br from-flare-pink-light/40 to-transparent animate-float" style={{ animationDelay: '-0.5s' }} />
        </div>
      </div>

      {/* Left decorative element */}
      <div className="absolute left-0 top-1/3 w-64 h-64 pointer-events-none opacity-40">
        <div className="w-full h-full dot-pattern" style={{
          maskImage: 'radial-gradient(ellipse 100% 100% at 0% 50%, black 30%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse 100% 100% at 0% 50%, black 30%, transparent 70%)'
        }} />
      </div>

      {/* Main Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="max-w-3xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-flare-pink/10 rounded-full mb-8 animate-fade-up">
            <div className="w-2 h-2 bg-flare-pink rounded-full animate-pulse" />
            <span className="text-sm font-semibold text-flare-pink">Powered by Flare Data Connector</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-gray-900 mb-6 animate-fade-up" style={{ animationDelay: '0.1s' }}>
            Instant FAsset
            <br />
            <span className="text-gradient">Redemptions</span>
          </h1>

          {/* Subheadline */}
          <p className="text-xl sm:text-2xl text-gray-600 mb-8 max-w-xl animate-fade-up" style={{ animationDelay: '0.2s' }}>
            Accelerate your FAsset redemptions with trust-minimized instant settlement. No more waiting.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap gap-4 mb-12 animate-fade-up" style={{ animationDelay: '0.3s' }}>
            <Link href="/redeem">
              <Button className="btn-primary h-14 px-8 text-lg font-semibold rounded-xl text-white">
                Start Redeeming
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link href="/mint">
              <Button variant="outline" className="h-14 px-8 text-lg font-semibold rounded-xl border-2 border-flare-pink text-flare-pink hover:bg-flare-pink/5">
                Mint FAssets
              </Button>
            </Link>
          </div>

          {/* Stats Row */}
          <div className="flex flex-wrap gap-8 animate-fade-up" style={{ animationDelay: '0.4s' }}>
            {stats.map((stat) => (
              <div key={stat.label} className="text-center sm:text-left">
                <div className="text-3xl sm:text-4xl font-bold text-gray-900">
                  <AnimatedCounter target={parseFloat(stat.value)} suffix={stat.suffix} />
                </div>
                <div className="text-sm text-gray-500 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Features Strip */}
      <div className="absolute bottom-0 left-0 right-0 bg-white/80 backdrop-blur-sm border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100">
            <FeatureItem
              icon={<Zap className="w-5 h-5" />}
              title="Instant Settlement"
              description="Get your XRP in seconds, not minutes"
            />
            <FeatureItem
              icon={<Shield className="w-5 h-5" />}
              title="Trust-Minimized"
              description="FDC adjudication ensures security"
            />
            <FeatureItem
              icon={<Clock className="w-5 h-5" />}
              title="No Idle Capital"
              description="Escrow-based conditional settlement"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureItem({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-center gap-4 py-5 px-6 group hover:bg-flare-pink/5 transition-colors">
      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-flare-pink/10 text-flare-pink flex items-center justify-center group-hover:bg-flare-pink group-hover:text-white transition-colors">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
    </div>
  );
}
