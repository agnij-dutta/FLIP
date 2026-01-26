"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { Github, Twitter, ExternalLink, ArrowUpRight, Send, Sparkles } from "lucide-react"
import { useState } from "react"

function StackedCircularFooter() {
  const [email, setEmail] = useState("")
  const [isHovered, setIsHovered] = useState(false)

  const navLinks = [
    { name: "Redeem", href: "/redeem" },
    { name: "LP Dashboard", href: "/lp" },
    { name: "Vault", href: "/vault" },
    { name: "Status", href: "/status" },
  ]

  const resourceLinks = [
    { name: "Flare Network", href: "https://flare.network", external: true },
    { name: "Block Explorer", href: "https://coston2-explorer.flare.network", external: true },
    { name: "Documentation", href: "#", external: false },
  ]

  return (
    <footer className="relative overflow-hidden bg-gradient-to-b from-gray-50 via-white to-white dark:from-gray-900 dark:via-gray-950 dark:to-gray-950">
      {/* Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Large gradient orb */}
        <div
          className="absolute -top-32 left-1/2 -translate-x-1/2 w-[800px] h-[400px] opacity-30 dark:opacity-20"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(227, 29, 101, 0.15) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />
        {/* Side accents */}
        <div className="absolute top-20 -left-20 w-64 h-64 bg-flare-pink/5 rounded-full blur-3xl" />
        <div className="absolute top-40 -right-20 w-48 h-48 bg-flare-pink-light/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
        {/* Main Footer Content */}
        <div className="flex flex-col items-center">

          {/* Logo Circle - Premium Glass Effect */}
          <div
            className="relative mb-12 group"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {/* Outer glow ring */}
            <div className={`absolute inset-0 rounded-full transition-all duration-700 ${isHovered ? 'scale-110 opacity-100' : 'scale-100 opacity-0'}`}>
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-flare-pink/20 via-flare-pink-light/20 to-flare-pink/20 blur-xl" />
            </div>

            {/* Main logo container */}
            <div className="relative p-8 rounded-full glass-card group-hover:scale-105 transition-transform duration-500">
              {/* Inner gradient border */}
              <div className="absolute inset-[2px] rounded-full bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900" />

              {/* Logo */}
              <div className="relative">
                <svg
                  width="56"
                  height="56"
                  viewBox="0 0 40 40"
                  fill="none"
                  className="transition-transform duration-500 group-hover:rotate-12"
                >
                  <defs>
                    <linearGradient id="footerLogoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#E31D65" />
                      <stop offset="50%" stopColor="#FF4081" />
                      <stop offset="100%" stopColor="#FF6B6B" />
                    </linearGradient>
                    <filter id="footerLogoGlow">
                      <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                      <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                  </defs>
                  <path
                    d="M20 4L4 12V28L20 36L36 28V12L20 4Z"
                    fill="url(#footerLogoGradient)"
                    filter="url(#footerLogoGlow)"
                  />
                  <path
                    d="M20 4L4 12L20 20L36 12L20 4Z"
                    fill="#FF4081"
                  />
                  <path
                    d="M12 16L20 20V28L12 24V16Z"
                    fill="white"
                    fillOpacity="0.4"
                  />
                  <path
                    d="M28 16L20 20V28L28 24V16Z"
                    fill="white"
                    fillOpacity="0.2"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Brand Name */}
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              FLIP <span className="text-gradient">Protocol</span>
            </h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto text-sm">
              Instant FAsset redemptions with trust-minimized settlement on Flare Network
            </p>
          </div>

          {/* Navigation Links - Pill Style */}
          <nav className="mb-12">
            <div className="flex flex-wrap justify-center gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className="px-5 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-flare-pink dark:hover:text-flare-pink rounded-full hover:bg-flare-pink/5 dark:hover:bg-flare-pink/10 transition-all duration-300"
                >
                  {link.name}
                </Link>
              ))}
              <span className="hidden sm:block w-px h-8 bg-gray-200 dark:bg-gray-700 mx-2 self-center" />
              {resourceLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noopener noreferrer" : undefined}
                  className="px-5 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-flare-pink dark:hover:text-flare-pink rounded-full hover:bg-flare-pink/5 dark:hover:bg-flare-pink/10 transition-all duration-300 inline-flex items-center gap-1"
                >
                  {link.name}
                  {link.external && <ExternalLink className="w-3 h-3 opacity-50" />}
                </a>
              ))}
            </div>
          </nav>

          {/* Social Links - Stacked Circular Design */}
          <div className="mb-12 flex items-center gap-3">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="group relative"
            >
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-flare-pink to-flare-pink-light opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-md" />
              <div className="relative w-12 h-12 rounded-full glass-card flex items-center justify-center text-gray-600 dark:text-gray-300 group-hover:text-flare-pink group-hover:border-flare-pink/20 transition-all duration-300 group-hover:scale-110">
                <Github className="w-5 h-5" />
              </div>
            </a>
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              className="group relative"
            >
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-flare-pink to-flare-pink-light opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-md" />
              <div className="relative w-12 h-12 rounded-full glass-card flex items-center justify-center text-gray-600 dark:text-gray-300 group-hover:text-flare-pink group-hover:border-flare-pink/20 transition-all duration-300 group-hover:scale-110">
                <Twitter className="w-5 h-5" />
              </div>
            </a>
            <a
              href="https://flare.network"
              target="_blank"
              rel="noopener noreferrer"
              className="group relative"
            >
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-flare-pink to-flare-pink-light opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-md" />
              <div className="relative w-12 h-12 rounded-full glass-card flex items-center justify-center text-gray-600 dark:text-gray-300 group-hover:text-flare-pink group-hover:border-flare-pink/20 transition-all duration-300 group-hover:scale-110">
                <Sparkles className="w-5 h-5" />
              </div>
            </a>
          </div>

          {/* Newsletter Subscription - Premium Design */}
          <div className="w-full max-w-md mb-16">
            <div className="relative">
              {/* Glass container */}
              <div className="relative glass-card rounded-2xl p-1.5">
                <form className="flex items-center gap-2" onSubmit={(e) => e.preventDefault()}>
                  <Input
                    type="email"
                    placeholder="Enter your email for updates"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1 h-12 px-5 bg-transparent border-0 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                  <Button
                    type="submit"
                    className="h-12 px-6 rounded-xl bg-gradient-to-r from-flare-pink to-flare-pink-light text-white font-semibold hover:shadow-pink transition-all duration-300 hover:scale-105 active:scale-95"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Subscribe
                  </Button>
                </form>
              </div>
            </div>
            <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-3">
              Get notified about protocol updates and new features
            </p>
          </div>

          {/* Divider with gradient */}
          <div className="w-full max-w-2xl h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-700 to-transparent mb-8" />

          {/* Bottom Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 w-full max-w-2xl">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              © 2024 FLIP Protocol. Built on{" "}
              <a
                href="https://flare.network"
                target="_blank"
                rel="noopener noreferrer"
                className="text-flare-pink hover:underline"
              >
                Flare Network
              </a>
            </p>

            {/* Network Status */}
            <div className="flex items-center gap-2 px-4 py-2 rounded-full glass-subtle">
              <div className="relative">
                <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                <div className="absolute inset-0 w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
              </div>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                Coston2 Testnet
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom gradient line */}
      <div className="h-1 bg-gradient-to-r from-transparent via-flare-pink/50 to-transparent" />
    </footer>
  )
}

export { StackedCircularFooter }
