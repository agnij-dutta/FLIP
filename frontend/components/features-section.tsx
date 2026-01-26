"use client";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Zap,
  TrendingUp,
  Shield,
  Lock,
  DollarSign,
  Clock,
  ArrowRight,
  ArrowUpRight,
  Layers,
  CheckCircle2,
  LucideIcon
} from "lucide-react";
import Link from "next/link";
import { ReactNode } from "react";

// Feature card with decorative corners
interface FeatureCardProps {
  children: ReactNode;
  className?: string;
}

const FeatureCard = ({ children, className }: FeatureCardProps) => (
  <Card className={cn(
    "group relative rounded-none border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm hover:shadow-xl transition-all duration-500",
    className
  )}>
    <CardDecorator />
    {children}
  </Card>
);

const CardDecorator = () => (
  <>
    <span className="border-flare-pink absolute -left-px -top-px block size-2 border-l-2 border-t-2"></span>
    <span className="border-flare-pink absolute -right-px -top-px block size-2 border-r-2 border-t-2"></span>
    <span className="border-flare-pink absolute -bottom-px -left-px block size-2 border-b-2 border-l-2"></span>
    <span className="border-flare-pink absolute -bottom-px -right-px block size-2 border-b-2 border-r-2"></span>
  </>
);

interface CardHeadingProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

const CardHeading = ({ icon: Icon, title, description }: CardHeadingProps) => (
  <div className="p-6">
    <span className="text-gray-500 dark:text-gray-400 flex items-center gap-2 text-sm font-medium">
      <Icon className="size-4 text-flare-pink" />
      {title}
    </span>
    <p className="mt-6 text-2xl font-semibold text-gray-900 dark:text-white">{description}</p>
  </div>
);

// Stats Section Component
function StatsSection() {
  return (
    <section className="relative py-32 overflow-hidden bg-white dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Fast Section */}
          <div className="relative">
            <div className="absolute -left-4 top-0 w-1 h-full bg-gradient-to-b from-flare-pink to-transparent"></div>
            <h2 className="text-7xl sm:text-8xl lg:text-9xl font-bold text-gray-900 dark:text-white leading-none">
              Fast
            </h2>
            <p className="mt-6 text-5xl sm:text-6xl font-mono text-flare-pink number-display">
              45<span className="text-2xl">s</span>
            </p>
            <p className="mt-4 text-gray-500 dark:text-gray-400 text-lg">
              Average settlement time with instant confidence scoring
            </p>
          </div>

          {/* Floating orbs decoration */}
          <div className="relative h-64 lg:h-96">
            <div className="absolute inset-0 flex items-center justify-center">
              {/* Large orb */}
              <div className="absolute w-32 h-32 rounded-full bg-gradient-to-br from-flare-pink to-flare-pink-light opacity-80 float shadow-pink-lg" />
              {/* Medium orbs */}
              <div className="absolute w-20 h-20 rounded-full bg-flare-pink/60 -top-4 right-20 float" style={{ animationDelay: '-2s' }} />
              <div className="absolute w-16 h-16 rounded-full bg-flare-pink-light/50 bottom-10 left-10 float" style={{ animationDelay: '-1s' }} />
              {/* Small orbs */}
              <div className="absolute w-10 h-10 rounded-full bg-white shadow-lg top-10 right-10 float" style={{ animationDelay: '-3s' }} />
              <div className="absolute w-8 h-8 rounded-full bg-flare-pink bottom-20 right-32 float" style={{ animationDelay: '-1.5s' }} />
              <div className="absolute w-6 h-6 rounded-full bg-white/80 shadow-md top-20 left-20 float" style={{ animationDelay: '-2.5s' }} />
              {/* Tiny orbs */}
              <div className="absolute w-4 h-4 rounded-full bg-flare-pink/40 top-32 right-8 float" style={{ animationDelay: '-0.5s' }} />
              <div className="absolute w-3 h-3 rounded-full bg-flare-pink-light bottom-8 left-32 float" style={{ animationDelay: '-4s' }} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Decentralized Section
function DecentralizedSection() {
  return (
    <section className="relative py-32 overflow-hidden bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Floating orbs decoration - left side */}
          <div className="relative h-64 lg:h-96 order-2 lg:order-1">
            <div className="absolute inset-0 flex items-center justify-center">
              {/* Cluster of orbs in organic arrangement */}
              <div className="absolute w-28 h-28 rounded-full bg-gradient-to-br from-flare-pink/70 to-flare-pink-light/50 float" style={{ left: '20%', top: '30%' }} />
              <div className="absolute w-20 h-20 rounded-full bg-flare-pink/50 float" style={{ left: '50%', top: '20%', animationDelay: '-1s' }} />
              <div className="absolute w-16 h-16 rounded-full bg-white shadow-lg float" style={{ left: '35%', top: '55%', animationDelay: '-2s' }} />
              <div className="absolute w-12 h-12 rounded-full bg-flare-pink-light/60 float" style={{ left: '60%', top: '50%', animationDelay: '-1.5s' }} />
              <div className="absolute w-10 h-10 rounded-full bg-flare-pink float" style={{ left: '25%', top: '70%', animationDelay: '-2.5s' }} />
              <div className="absolute w-8 h-8 rounded-full bg-white/90 shadow-md float" style={{ left: '70%', top: '35%', animationDelay: '-3s' }} />
              <div className="absolute w-6 h-6 rounded-full bg-flare-pink/40 float" style={{ left: '45%', top: '75%', animationDelay: '-0.5s' }} />
            </div>
          </div>

          {/* Content */}
          <div className="relative order-1 lg:order-2">
            <h2 className="text-6xl sm:text-7xl lg:text-8xl font-bold text-gray-900 dark:text-white leading-none">
              Decentralized
            </h2>
            <p className="mt-6 text-4xl sm:text-5xl font-mono text-flare-pink number-display">
              100<span className="text-xl ml-1">Data Providers</span>
            </p>
            <p className="mt-4 text-gray-500 dark:text-gray-400 text-lg">
              FTSO maximum stake per data provider ensures true decentralization
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// Secure Section
function SecureSection() {
  return (
    <section className="relative py-32 overflow-hidden bg-white dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Content */}
          <div className="relative">
            <h2 className="text-7xl sm:text-8xl lg:text-9xl font-bold text-gray-900 dark:text-white leading-none">
              Secure
            </h2>
            <div className="mt-6 inline-flex items-center gap-3 px-6 py-3 bg-flare-pink/10 rounded-full">
              <span className="text-3xl font-bold text-flare-pink number-display">99.7%</span>
              <span className="text-gray-600 dark:text-gray-300 font-medium">Confidence Rate</span>
            </div>
            <p className="mt-4 text-gray-500 dark:text-gray-400 text-lg">
              FDC-backed verification ensures every redemption is secured by consensus
            </p>
          </div>

          {/* Floating orbs decoration */}
          <div className="relative h-64 lg:h-96">
            <div className="absolute inset-0 flex items-center justify-center">
              {/* Shield-like arrangement */}
              <div className="absolute w-36 h-36 rounded-full bg-gradient-to-br from-flare-pink/60 to-flare-pink-light/40 float shadow-pink" />
              <div className="absolute w-24 h-24 rounded-full bg-flare-pink/40 -top-2 left-1/3 float" style={{ animationDelay: '-1s' }} />
              <div className="absolute w-20 h-20 rounded-full bg-white shadow-xl top-1/3 right-8 float" style={{ animationDelay: '-2s' }} />
              <div className="absolute w-14 h-14 rounded-full bg-flare-pink bottom-16 left-16 float" style={{ animationDelay: '-1.5s' }} />
              <div className="absolute w-10 h-10 rounded-full bg-flare-pink-light/70 bottom-8 right-24 float" style={{ animationDelay: '-2.5s' }} />
              <div className="absolute w-8 h-8 rounded-full bg-white shadow-md top-8 right-16 float" style={{ animationDelay: '-3s' }} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Features Grid with 21st.dev-inspired cards
function FeaturesGrid() {
  return (
    <section className="relative py-32 overflow-hidden bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <span className="section-label">Core Technology</span>
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mt-4">
            Built on <span className="text-gradient">Flare</span>
          </h2>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Card 1 - Instant Redemption */}
          <FeatureCard>
            <CardHeader className="pb-3">
              <CardHeading
                icon={Zap}
                title="Instant Redemption"
                description="Request redemption and get instant provisional settlement when confidence is high."
              />
            </CardHeader>
            <div className="relative mb-6 border-t border-dashed border-gray-200 dark:border-gray-700">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white dark:to-gray-900"></div>
              <div className="p-6">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-flare-pink to-flare-pink-light flex items-center justify-center">
                    <Zap className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white number-display">99.7%+</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Confidence threshold</p>
                  </div>
                </div>
              </div>
            </div>
          </FeatureCard>

          {/* Card 2 - FDC Verification */}
          <FeatureCard>
            <CardHeader className="pb-3">
              <CardHeading
                icon={Shield}
                title="FDC Adjudication"
                description="Flare Data Connector is the final judge. All redemptions verified by consensus."
              />
            </CardHeader>
            <CardContent>
              <div className="relative">
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-3 mb-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">Verification Status</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Payment Confirmed</span>
                      <span className="text-emerald-500 font-medium">Verified</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">FDC Attestation</span>
                      <span className="text-emerald-500 font-medium">Complete</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Settlement</span>
                      <span className="text-flare-pink font-medium">Released</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </FeatureCard>

          {/* Wide Card - Process Flow */}
          <FeatureCard className="p-6 lg:col-span-2">
            <p className="mx-auto my-4 max-w-lg text-balance text-center text-xl font-semibold text-gray-900 dark:text-white">
              From redemption request to receiving your native XRP in seconds.
            </p>

            <div className="flex justify-center gap-4 sm:gap-6 overflow-x-auto py-4">
              <ProcessStep step="01" label="Request" active />
              <ProcessStep step="02" label="Score" />
              <ProcessStep step="03" label="Match LP" />
              <ProcessStep step="04" label="Settle" />
            </div>
          </FeatureCard>
        </div>
      </div>
    </section>
  );
}

// Process Step Component
function ProcessStep({ step, label, active }: { step: string; label: string; active?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={cn(
        "relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center font-bold text-lg border-2 transition-all",
        active
          ? "bg-flare-pink text-white border-flare-pink shadow-pink"
          : "bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-200 dark:border-gray-700"
      )}>
        {step}
      </div>
      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</span>
    </div>
  );
}

// Build on FLIP Section
function BuildSection() {
  return (
    <section className="relative py-32 overflow-hidden bg-white dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Content */}
          <div>
            <span className="section-label">For Developers</span>
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mt-4 mb-6">
              Build on <span className="text-gradient">FLIP</span>
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
              Integrate instant FAsset redemptions into your dApp. Simple API, powerful results.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link href="https://docs.flare.network" target="_blank">
                <button className="group inline-flex items-center gap-2 px-6 py-3 bg-flare-pink text-white font-semibold rounded-xl hover:bg-flare-pink-dark transition-all hover:shadow-pink hover:-translate-y-0.5">
                  Developer Docs
                  <ArrowUpRight className="w-5 h-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </button>
              </Link>
              <Link href="https://github.com" target="_blank">
                <button className="inline-flex items-center gap-2 px-6 py-3 border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl hover:border-flare-pink hover:text-flare-pink transition-all">
                  View on GitHub
                </button>
              </Link>
            </div>
          </div>

          {/* Code Preview */}
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-r from-gray-900 to-gray-800 rounded-3xl blur-xl opacity-20 dark:opacity-40" />
            <div className="relative bg-gray-900 rounded-2xl overflow-hidden border border-gray-800 shadow-2xl">
              {/* Code Header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <span className="text-gray-500 text-sm ml-2 font-mono">redemption.ts</span>
              </div>

              {/* Code Content */}
              <div className="p-6 overflow-x-auto">
                <pre className="text-sm font-mono">
                  <code>
                    <span className="text-purple-400">const</span>{" "}
                    <span className="text-blue-300">flip</span>{" "}
                    <span className="text-white">=</span>{" "}
                    <span className="text-yellow-300">new</span>{" "}
                    <span className="text-green-400">FLIPProtocol</span>
                    <span className="text-white">(</span>
                    <span className="text-orange-300">provider</span>
                    <span className="text-white">);</span>
                    {"\n\n"}
                    {/* Request instant redemption */}
                    {"\n"}
                    <span className="text-purple-400">const</span>{" "}
                    <span className="text-blue-300">result</span>{" "}
                    <span className="text-white">=</span>{" "}
                    <span className="text-yellow-300">await</span>{" "}
                    <span className="text-blue-300">flip</span>
                    <span className="text-white">.</span>
                    <span className="text-green-400">redeem</span>
                    <span className="text-white">({"{"}</span>
                    {"\n"}
                    <span className="text-white">{"  "}</span>
                    <span className="text-blue-300">amount</span>
                    <span className="text-white">:</span>{" "}
                    <span className="text-orange-300">&quot;1000&quot;</span>
                    <span className="text-white">,</span>
                    {"\n"}
                    <span className="text-white">{"  "}</span>
                    <span className="text-blue-300">asset</span>
                    <span className="text-white">:</span>{" "}
                    <span className="text-orange-300">&quot;FXrp&quot;</span>
                    <span className="text-white">,</span>
                    {"\n"}
                    <span className="text-white">{"  "}</span>
                    <span className="text-blue-300">destination</span>
                    <span className="text-white">:</span>{" "}
                    <span className="text-orange-300">xrplAddress</span>
                    {"\n"}
                    <span className="text-white">{"})"}</span>
                    <span className="text-white">;</span>
                    {"\n\n"}
                    {/* Get confidence score */}
                    {"\n"}
                    <span className="text-purple-400">const</span>{" "}
                    <span className="text-blue-300">score</span>{" "}
                    <span className="text-white">=</span>{" "}
                    <span className="text-blue-300">result</span>
                    <span className="text-white">.</span>
                    <span className="text-blue-300">confidenceScore</span>
                    <span className="text-white">;</span>{" "}
                    {/* 99.7% */}
                  </code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// LP Features Section
function LPSection() {
  return (
    <section className="relative py-32 overflow-hidden bg-white dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Content */}
          <div>
            <span className="section-label">For Liquidity Providers</span>
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mt-4 mb-6">
              Earn by providing <span className="text-gradient">liquidity</span>
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
              Optional liquidity providers enable fast settlement. Participate with customizable parameters and earn competitive yields.
            </p>

            <div className="space-y-4 mb-8">
              {[
                "Set your own minimum spread and confidence thresholds",
                "Escrow-protected - funds safe until FDC confirms",
                "Automated matching with redemption requests",
                "Withdraw anytime with no lock-up periods"
              ].map((feature, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mt-0.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                </div>
              ))}
            </div>

            <Link href="/lp">
              <button className="group inline-flex items-center gap-2 px-6 py-3 bg-flare-pink text-white font-semibold rounded-xl hover:bg-flare-pink-dark transition-all hover:shadow-pink hover:-translate-y-0.5">
                Become an LP
                <ArrowUpRight className="w-5 h-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </button>
            </Link>
          </div>

          {/* LP Dashboard Preview Card */}
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-r from-flare-pink/20 to-flare-pink-light/10 rounded-3xl blur-2xl" />
            <div className="relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-gray-900 dark:text-white">LP Position</h3>
                <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-sm font-medium rounded-full">Active</span>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <span className="text-gray-500 dark:text-gray-400">Deposited</span>
                  <span className="text-xl font-bold text-gray-900 dark:text-white number-display">10,000 C2FLR</span>
                </div>
                <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <span className="text-gray-500 dark:text-gray-400">Earned</span>
                  <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 number-display">+127.5 C2FLR</span>
                </div>
                <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <span className="text-gray-500 dark:text-gray-400">APY</span>
                  <span className="text-xl font-bold text-flare-pink number-display">12.75%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// CTA Section
function CTASection() {
  return (
    <section className="relative py-32 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-flare-pink via-flare-pink-dark to-flare-magenta" />

      {/* Floating orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute left-1/4 top-1/4 w-96 h-96 rounded-full bg-white/10 blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
        <div className="absolute right-1/4 bottom-1/4 w-80 h-80 rounded-full bg-white/10 blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
      </div>

      {/* Small floating spheres */}
      <div className="absolute left-10 top-10 w-20 h-20 rounded-full bg-white/10 float" />
      <div className="absolute right-20 bottom-20 w-16 h-16 rounded-full bg-white/15 float" style={{ animationDelay: '-3s' }} />
      <div className="absolute left-1/3 bottom-16 w-12 h-12 rounded-full bg-white/20 float" style={{ animationDelay: '-1.5s' }} />
      <div className="absolute right-1/3 top-20 w-10 h-10 rounded-full bg-white/10 float" style={{ animationDelay: '-4s' }} />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
          Ready to experience instant redemptions?
        </h2>
        <p className="text-xl text-white/80 mb-12 max-w-2xl mx-auto">
          Join the growing number of users who trust FLIP for their FAsset redemptions. Start today.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/redeem">
            <button className="group px-8 py-4 bg-white text-flare-pink font-bold rounded-2xl hover:bg-gray-50 transition-all duration-300 shadow-2xl hover:shadow-white/20 hover:-translate-y-1 flex items-center gap-2">
              Start Redeeming
              <ArrowUpRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </button>
          </Link>
          <Link href="/lp">
            <button className="px-8 py-4 bg-transparent text-white font-bold rounded-2xl border-2 border-white/30 hover:bg-white/10 hover:border-white/50 transition-all duration-300">
              Become an LP
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
}

// Trust Banner
function TrustBanner() {
  return (
    <section className="relative py-10 overflow-hidden bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="glass rounded-3xl p-8 flex flex-col md:flex-row items-center justify-center gap-4 text-center md:text-left">
          <div className="w-14 h-14 rounded-2xl bg-flare-pink/10 flex items-center justify-center">
            <Lock className="w-7 h-7 text-flare-pink" />
          </div>
          <div>
            <p className="text-lg text-gray-700 dark:text-gray-200">
              <span className="font-bold text-gray-900 dark:text-white">FDC is the final judge.</span>
              {" "}FLIP only changes when users get paid. Your funds are always protected.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// Main Export
export function FeaturesSection() {
  return (
    <>
      <StatsSection />
      <DecentralizedSection />
      <SecureSection />
      <FeaturesGrid />
      <BuildSection />
      <LPSection />
      <CTASection />
      <TrustBanner />
    </>
  );
}
