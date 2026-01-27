"use client";

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { Menu, X, ChevronDown, Sun, Moon, Sparkles, Zap, Search, FileText } from 'lucide-react';
import { useTheme } from 'next-themes';

export function Header() {
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);

    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!mounted) {
    return <HeaderSkeleton />;
  }

  return <HeaderContent scrolled={scrolled} mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} />;
}

function HeaderContent({
  scrolled,
  mobileMenuOpen,
  setMobileMenuOpen
}: {
  scrolled: boolean;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}) {
  const { isConnected } = useAccount();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const navLinks = [
    { name: 'Mint', href: '/mint' },
    { name: 'Redeem', href: '/redeem', icon: Zap },
    { name: 'LP Dashboard', href: '/lp' },
    { name: 'Vault', href: '/vault' },
    { name: 'Status', href: '/status' },
    { name: 'XRPL Explorer', href: '/xrpl-explorer', icon: Search },
  ];

  const specialLinks = [
    { name: 'Whitepaper', href: '/whitepaper', icon: FileText },
  ];

  return (
    <>
      <header className={`navbar-glass ${scrolled ? 'scrolled' : ''}`}>
        <div className="px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 group flex-shrink-0">
              <div className="relative">
                {/* Logo glow on hover */}
                <div className="absolute inset-0 bg-flare-pink/30 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 scale-150" />
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 40 40"
                  fill="none"
                  className="relative transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6"
                >
                  <defs>
                    <linearGradient id="headerLogoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#E31D65" />
                      <stop offset="100%" stopColor="#FF4081" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M20 4L4 12V28L20 36L36 28V12L20 4Z"
                    fill="url(#headerLogoGradient)"
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
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
                  FLIP
                </span>
                <span className="text-xs font-semibold text-flare-pink tracking-wider">
                  PROTOCOL
                </span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center flex-shrink-0">
              <div className="flex items-center gap-0.5 px-1.5 py-1.5 rounded-full bg-gray-100/50 dark:bg-gray-800/50">
                {navLinks.map((link) => (
                  <Link
                    key={link.name}
                    href={link.href}
                    className="relative px-3 py-1.5 text-[13px] font-medium text-gray-600 dark:text-gray-300 hover:text-flare-pink dark:hover:text-flare-pink rounded-full hover:bg-white dark:hover:bg-gray-700 transition-all duration-300 whitespace-nowrap"
                  >
                    {link.name}
                  </Link>
                ))}
                {/* Divider */}
                <div className="w-px h-4 bg-gray-300/50 dark:bg-gray-600/50 mx-0.5" />
                {/* Special Links inline */}
                {specialLinks.map((link) => (
                  <Link
                    key={link.name}
                    href={link.href}
                    className="relative flex items-center gap-1 px-3 py-1.5 text-[13px] font-semibold text-flare-pink rounded-full bg-flare-pink/8 hover:bg-flare-pink hover:text-white transition-all duration-300 whitespace-nowrap"
                  >
                    {link.icon && <link.icon className="w-3 h-3" />}
                    {link.name}
                  </Link>
                ))}
              </div>
            </nav>

            {/* Right Side */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Theme Toggle */}
              {mounted && (
                <button
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="relative p-2.5 rounded-xl bg-gray-100/80 dark:bg-gray-800/80 hover:bg-flare-pink/10 dark:hover:bg-flare-pink/20 transition-all duration-300 group"
                  aria-label="Toggle theme"
                >
                  {theme === 'dark' ? (
                    <Sun className="w-4 h-4 text-gray-500 dark:text-gray-400 group-hover:text-flare-pink transition-colors" />
                  ) : (
                    <Moon className="w-4 h-4 text-gray-500 dark:text-gray-400 group-hover:text-flare-pink transition-colors" />
                  )}
                </button>
              )}

              {/* Connect Wallet Button */}
              <div className="hidden sm:block">
                <ConnectButton.Custom>
                  {({
                    account,
                    chain,
                    openAccountModal,
                    openChainModal,
                    openConnectModal,
                    mounted: btnMounted,
                  }) => {
                    const ready = btnMounted;
                    const connected = ready && account && chain;

                    return (
                      <div
                        {...(!ready && {
                          'aria-hidden': true,
                          style: {
                            opacity: 0,
                            pointerEvents: 'none',
                            userSelect: 'none',
                          },
                        })}
                      >
                        {(() => {
                          if (!connected) {
                            return (
                              <button
                                onClick={openConnectModal}
                                className="group relative px-5 py-2.5 bg-gradient-to-r from-flare-pink to-flare-pink-light text-white font-semibold rounded-xl transition-all duration-300 hover:shadow-pink hover:-translate-y-0.5 overflow-hidden"
                              >
                                <span className="relative z-10 flex items-center gap-2">
                                  <Sparkles className="w-4 h-4" />
                                  Connect
                                </span>
                                <div className="absolute inset-0 bg-gradient-to-r from-flare-pink-light to-flare-pink opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                              </button>
                            );
                          }

                          if (chain.unsupported) {
                            return (
                              <button
                                onClick={openChainModal}
                                className="px-5 py-2.5 bg-red-500 text-white font-semibold rounded-xl hover:bg-red-600 transition-all"
                              >
                                Wrong Network
                              </button>
                            );
                          }

                          return (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={openChainModal}
                                className="flex items-center gap-2 px-3 py-2 glass-subtle rounded-xl transition-all hover:bg-white/80 dark:hover:bg-gray-800/80"
                              >
                                {chain.hasIcon && chain.iconUrl && (
                                  <div className="w-5 h-5 rounded-full overflow-hidden">
                                    <Image
                                      alt={chain.name ?? 'Chain icon'}
                                      src={chain.iconUrl}
                                      width={20}
                                      height={20}
                                      className="w-5 h-5"
                                      unoptimized
                                    />
                                  </div>
                                )}
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-200 hidden lg:inline">{chain.name}</span>
                                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                              </button>

                              <button
                                onClick={openAccountModal}
                                className="flex items-center gap-2 px-4 py-2 glass-pink rounded-xl transition-all hover:bg-flare-pink/15"
                              >
                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                <span className="text-sm font-semibold text-flare-pink">
                                  {account.displayName}
                                </span>
                              </button>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  }}
                </ConnectButton.Custom>
              </div>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2.5 text-gray-600 dark:text-gray-300 hover:text-flare-pink rounded-xl hover:bg-flare-pink/10 transition-all"
              >
                {mobileMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <div
          className={`lg:hidden overflow-hidden transition-all duration-300 ease-out-expo ${
            mobileMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="border-t border-gray-100/50 dark:border-gray-800/50">
            <div className="px-4 py-4 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-4 py-3 text-base font-medium text-gray-700 dark:text-gray-200 hover:text-flare-pink hover:bg-flare-pink/5 rounded-xl transition-all"
                >
                  {link.name}
                </Link>
              ))}
              {/* Special links section */}
              <div className="pt-3 mt-3 border-t border-gray-100 dark:border-gray-800">
                {specialLinks.map((link) => (
                  <Link
                    key={link.name}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-3 text-base font-semibold text-flare-pink hover:bg-flare-pink/5 rounded-xl transition-all"
                  >
                    {link.icon && <link.icon className="w-4 h-4" />}
                    {link.name}
                  </Link>
                ))}
              </div>
              <div className="pt-4 border-t border-gray-100 dark:border-gray-800 mt-4">
                <ConnectButton />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Spacer for floating navbar */}
      <div className="h-24" />
    </>
  );
}

function HeaderSkeleton() {
  return (
    <>
      <header className="navbar-glass">
        <div className="px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
              <div className="flex items-center gap-1">
                <div className="w-12 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="w-16 h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
            </div>
            <div className="hidden lg:flex items-center">
              <div className="flex items-center gap-0.5 px-1.5 py-1.5 rounded-full bg-gray-100/50 dark:bg-gray-800/50">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="w-16 h-7 bg-gray-200/50 dark:bg-gray-700/50 rounded-full animate-pulse" />
                ))}
                <div className="w-px h-4 bg-gray-300/50 dark:bg-gray-600/50 mx-0.5" />
                <div className="w-20 h-7 bg-pink-100/50 dark:bg-pink-900/20 rounded-full animate-pulse" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
              <div className="w-28 h-10 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
            </div>
          </div>
        </div>
      </header>
      <div className="h-24" />
    </>
  );
}
