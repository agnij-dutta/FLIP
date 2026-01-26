"use client"

import { ArrowRight, Zap, Shield, Clock } from "lucide-react"
import { useState, Suspense, lazy } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

const Dithering = lazy(() =>
  import("@paper-design/shaders-react").then((mod) => ({ default: mod.Dithering }))
)

// Partner logos component
function PartnerLogos() {
  const partners = [
    { name: "Flare", logo: "FLR" },
    { name: "XRPL", logo: "XRP" },
    { name: "FTSO", logo: "FTSO" },
    { name: "FDC", logo: "FDC" },
  ]

  return (
    <div className="mt-16 pt-8 border-t border-gray-200/50 dark:border-gray-800/50">
      <p className="text-center text-sm text-gray-400 dark:text-gray-500 mb-6 font-medium tracking-wide uppercase">
        Built with the best
      </p>
      <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
        {partners.map((partner) => (
          <div
            key={partner.name}
            className="flex items-center gap-2 text-gray-400 dark:text-gray-500 hover:text-flare-pink transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <span className="text-xs font-bold">{partner.logo}</span>
            </div>
            <span className="font-semibold text-sm">{partner.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function HeroDitheringCard() {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <section className="pt-8 pb-4 w-full flex flex-col items-center px-4 md:px-6">
      <div
        className="w-full max-w-7xl relative"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="relative overflow-hidden rounded-[48px] border border-flare-pink/20 dark:border-flare-pink/40 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-950 shadow-xl min-h-[550px] md:min-h-[600px] flex flex-col items-center justify-center duration-500">
          {/* Dithering Background */}
          <Suspense fallback={<div className="absolute inset-0 bg-flare-pink/5 dark:bg-flare-pink/10" />}>
            <div className="absolute inset-0 z-0 pointer-events-none opacity-40 dark:opacity-60 mix-blend-multiply dark:mix-blend-screen">
              <Dithering
                colorBack="#00000000"
                colorFront="#FF4081"
                shape="warp"
                type="4x4"
                speed={isHovered ? 0.6 : 0.2}
                className="size-full"
                minPixelRatio={1}
              />
            </div>
          </Suspense>

          {/* Gradient Overlay - reduced opacity in dark mode */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-white/80 dark:from-gray-950/20 dark:via-transparent dark:to-gray-950/60 z-[1]" />

          {/* Content */}
          <div className="relative z-10 px-6 pb-32 max-w-4xl mx-auto text-center flex flex-col items-center">

            {/* Badge */}
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-flare-pink/20 dark:border-flare-pink/40 bg-white/80 dark:bg-gray-900/60 backdrop-blur-md px-4 py-2 text-sm font-semibold text-flare-pink dark:text-flare-pink-light shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-flare-pink dark:bg-flare-pink-light opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-flare-pink dark:bg-flare-pink-light"></span>
              </span>
              Powered by Flare Data Connector
            </div>

            {/* Headline */}
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight text-gray-900 dark:text-white mb-6 leading-[1.05]">
              Instant FAsset
              <br />
              <span className="bg-gradient-to-r from-flare-pink to-flare-pink-light dark:from-flare-pink-light dark:to-flare-coral bg-clip-text text-transparent">
                Redemptions
              </span>
            </h1>

            {/* Description */}
            <p className="text-gray-600 dark:text-gray-300 text-lg md:text-xl max-w-2xl mb-10 leading-relaxed">
              Accelerate your FAsset redemptions with trust-minimized instant settlement.
              No more waiting. Get your XRP in seconds.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/redeem">
                <Button className="group relative inline-flex h-14 items-center justify-center gap-3 overflow-hidden rounded-full bg-flare-pink dark:bg-flare-pink-light px-10 text-base font-semibold text-white transition-all duration-300 hover:bg-flare-pink-dark dark:hover:bg-flare-pink hover:scale-105 active:scale-95 hover:ring-4 hover:ring-flare-pink/20 dark:hover:ring-flare-pink-light/30 shadow-pink">
                  <span className="relative z-10">Start Redeeming</span>
                  <ArrowRight className="h-5 w-5 relative z-10 transition-transform duration-300 group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link href="/lp">
                <Button variant="outline" className="h-14 px-10 text-base font-semibold rounded-full border-2 border-flare-pink dark:border-flare-pink-light text-flare-pink dark:text-flare-pink-light hover:bg-flare-pink/10 dark:hover:bg-flare-pink-light/10 transition-all duration-300 hover:scale-105 active:scale-95">
                  Become an LP
                </Button>
              </Link>
            </div>
          </div>

          {/* Bottom Features Strip */}
          <div className="absolute bottom-0 left-0 right-0 bg-white/95 dark:bg-gray-900/90 backdrop-blur-md border-t border-gray-100 dark:border-gray-800 rounded-b-[48px] z-10">
            <div className="max-w-5xl mx-auto px-4 md:px-6">
              <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100 dark:divide-gray-800">
                <FeatureItem
                  icon={<Zap className="w-5 h-5" />}
                  title="Instant Settlement"
                  description="Get your XRP in seconds"
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
        </div>
      </div>

      {/* Partner Logos Section */}
      <div className="w-full max-w-5xl">
        <PartnerLogos />
      </div>
    </section>
  )
}

function FeatureItem({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-center gap-4 py-5 px-6 group hover:bg-flare-pink/5 dark:hover:bg-flare-pink/10 transition-colors">
      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-flare-pink/10 dark:bg-flare-pink/20 text-flare-pink dark:text-flare-pink-light flex items-center justify-center group-hover:bg-flare-pink group-hover:text-white transition-colors">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
      </div>
    </div>
  )
}

// Export default as well for flexibility
export default HeroDitheringCard
