"use client";

import { Header } from "@/components/header";
import { useState, useEffect, useRef } from "react";
import {
  BookOpen,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Copy,
  Check,
  ArrowUp,
  Menu,
  X,
  FileText,
  Shield,
  Layers,
  GitBranch,
  Cpu,
  Droplets,
  Calculator,
  Lock,
  Coins,
  Map,
  Scale,
  AlertTriangle,
} from "lucide-react";

// ─── Section Data ───────────────────────────────────────────────

interface Section {
  id: string;
  title: string;
  icon: React.ReactNode;
  subsections?: { id: string; title: string }[];
}

const sections: Section[] = [
  {
    id: "executive-summary",
    title: "Executive Summary",
    icon: <FileText className="w-4 h-4" />,
  },
  {
    id: "background",
    title: "1. Background & Problem",
    icon: <BookOpen className="w-4 h-4" />,
    subsections: [
      { id: "fassets-latency", title: "1.1 FAssets Latency" },
      { id: "existing-solutions", title: "1.2 Why Existing Solutions Fail" },
    ],
  },
  {
    id: "design-principles",
    title: "2. Design Principles",
    icon: <Shield className="w-4 h-4" />,
  },
  {
    id: "architecture",
    title: "3. System Architecture",
    icon: <Layers className="w-4 h-4" />,
    subsections: [
      { id: "on-chain", title: "3.1 On-Chain Layer" },
      { id: "off-chain", title: "3.2 Off-Chain Agent Layer" },
      { id: "oracle-layer", title: "3.3 Oracle Layer" },
    ],
  },
  {
    id: "flow",
    title: "4. End-to-End Flow",
    icon: <GitBranch className="w-4 h-4" />,
    subsections: [
      { id: "minting", title: "4.1 Minting (XRP → FXRP)" },
      { id: "redemption-request", title: "4.2 Redemption Request" },
      { id: "fast-path", title: "4.3 Fast Path" },
      { id: "standard-path", title: "4.4 Standard Path" },
    ],
  },
  {
    id: "decision-model",
    title: "5. Deterministic Decision Model",
    icon: <Cpu className="w-4 h-4" />,
  },
  {
    id: "liquidity",
    title: "6. Liquidity Model",
    icon: <Droplets className="w-4 h-4" />,
    subsections: [
      { id: "direct-lp", title: "6.1 Direct LPs" },
      { id: "amm-backstop", title: "6.2 AMM Backstop" },
    ],
  },
  {
    id: "escrow-math",
    title: "7. Escrow & Capital Mathematics",
    icon: <Calculator className="w-4 h-4" />,
  },
  {
    id: "security",
    title: "8. Security & Trust Model",
    icon: <Lock className="w-4 h-4" />,
  },
  {
    id: "tokenomics",
    title: "9. Tokenomics",
    icon: <Coins className="w-4 h-4" />,
  },
  {
    id: "roadmap",
    title: "10. Roadmap",
    icon: <Map className="w-4 h-4" />,
  },
  {
    id: "comparison",
    title: "11. FLIP vs Firelight",
    icon: <Scale className="w-4 h-4" />,
  },
  {
    id: "conclusion",
    title: "12. Conclusion",
    icon: <BookOpen className="w-4 h-4" />,
  },
  {
    id: "disclaimer",
    title: "Legal Disclaimer",
    icon: <AlertTriangle className="w-4 h-4" />,
  },
];

// ─── Code Block Component ────────────────────────────────────────

function CodeBlock({ children, label }: { children: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-6 group">
      {label && (
        <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-800/80 border border-b-0 border-gray-200 dark:border-gray-700/60 rounded-t-xl">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 tracking-wider uppercase font-mono">
            {label}
          </span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-flare-pink transition-colors"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}
      <pre
        className={`px-5 py-4 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-gray-700/60 overflow-x-auto text-sm leading-relaxed font-mono text-gray-800 dark:text-gray-200 ${
          label ? "rounded-b-xl" : "rounded-xl"
        }`}
      >
        <code>{children}</code>
      </pre>
    </div>
  );
}

// ─── Callout Component ───────────────────────────────────────────

function Callout({
  type = "info",
  title,
  children,
}: {
  type?: "info" | "warning" | "success" | "important";
  title?: string;
  children: React.ReactNode;
}) {
  const styles = {
    info: {
      bg: "bg-blue-50/80 dark:bg-blue-900/10",
      border: "border-blue-300 dark:border-blue-700/50",
      icon: "text-blue-500",
      title: "text-blue-700 dark:text-blue-400",
    },
    warning: {
      bg: "bg-amber-50/80 dark:bg-amber-900/10",
      border: "border-amber-300 dark:border-amber-700/50",
      icon: "text-amber-500",
      title: "text-amber-700 dark:text-amber-400",
    },
    success: {
      bg: "bg-emerald-50/80 dark:bg-emerald-900/10",
      border: "border-emerald-300 dark:border-emerald-700/50",
      icon: "text-emerald-500",
      title: "text-emerald-700 dark:text-emerald-400",
    },
    important: {
      bg: "bg-pink-50/80 dark:bg-pink-900/10",
      border: "border-flare-pink/30 dark:border-flare-pink/20",
      icon: "text-flare-pink",
      title: "text-flare-pink dark:text-flare-pink-light",
    },
  };

  const s = styles[type];

  return (
    <div className={`my-6 p-5 rounded-xl border-l-4 ${s.bg} ${s.border}`}>
      {title && (
        <div className={`flex items-center gap-2 font-semibold text-sm mb-2 ${s.title}`}>
          <Shield className={`w-4 h-4 ${s.icon}`} />
          {title}
        </div>
      )}
      <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        {children}
      </div>
    </div>
  );
}

// ─── Sidebar Component ───────────────────────────────────────────

function Sidebar({
  activeSection,
  expandedSections,
  toggleSection,
  onClose,
  isMobile,
}: {
  activeSection: string;
  expandedSections: Set<string>;
  toggleSection: (id: string) => void;
  onClose?: () => void;
  isMobile?: boolean;
}) {
  return (
    <nav className={`${isMobile ? "" : "sticky top-28"} h-fit`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-flare-pink to-flare-pink-light flex items-center justify-center shadow-pink">
            <BookOpen className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Whitepaper
            </h3>
            <span className="text-[10px] font-mono font-semibold text-gray-400 dark:text-gray-500 tracking-wider">
              v2.1
            </span>
          </div>
        </div>
        {isMobile && onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        )}
      </div>

      {/* Section links */}
      <div className="space-y-0.5">
        {sections.map((section) => {
          const isActive = activeSection === section.id;
          const isExpanded = expandedSections.has(section.id);
          const hasSubsections = section.subsections && section.subsections.length > 0;
          const isSubActive =
            section.subsections?.some((sub) => activeSection === sub.id) ?? false;

          return (
            <div key={section.id}>
              {/* Main section link */}
              <a
                href={`#${section.id}`}
                onClick={(e) => {
                  if (hasSubsections) {
                    e.preventDefault();
                    toggleSection(section.id);
                    // Also scroll to section
                    const el = document.getElementById(section.id);
                    if (el) {
                      el.scrollIntoView({ behavior: "smooth", block: "start" });
                    }
                  }
                  if (isMobile && onClose) onClose();
                }}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 group
                  ${
                    isActive || isSubActive
                      ? "bg-flare-pink/8 text-flare-pink dark:text-flare-pink-light"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-gray-200"
                  }`}
              >
                <span
                  className={`flex-shrink-0 transition-colors ${
                    isActive || isSubActive
                      ? "text-flare-pink"
                      : "text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300"
                  }`}
                >
                  {section.icon}
                </span>
                <span className="flex-1 truncate">{section.title}</span>
                {hasSubsections && (
                  <ChevronRight
                    className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${
                      isExpanded ? "rotate-90" : ""
                    } ${
                      isActive || isSubActive
                        ? "text-flare-pink/60"
                        : "text-gray-300 dark:text-gray-600"
                    }`}
                  />
                )}
                {/* Active indicator */}
                {isActive && (
                  <div className="absolute left-0 w-0.5 h-5 bg-flare-pink rounded-r-full" />
                )}
              </a>

              {/* Subsections */}
              {hasSubsections && isExpanded && (
                <div className="ml-[18px] mt-0.5 mb-1 pl-4 border-l border-gray-200 dark:border-gray-700/50 space-y-0.5">
                  {section.subsections!.map((sub) => {
                    const isSubItemActive = activeSection === sub.id;
                    return (
                      <a
                        key={sub.id}
                        href={`#${sub.id}`}
                        onClick={() => {
                          if (isMobile && onClose) onClose();
                        }}
                        className={`block px-3 py-1.5 rounded-md text-[12.5px] transition-all duration-200
                          ${
                            isSubItemActive
                              ? "text-flare-pink dark:text-flare-pink-light font-semibold bg-flare-pink/5"
                              : "text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/40"
                          }`}
                      >
                        {sub.title}
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer info */}
      <div className="mt-8 pt-5 border-t border-gray-200 dark:border-gray-700/50">
        <div className="flex items-center gap-2 text-[11px] text-gray-400 dark:text-gray-600">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>Testnet-complete, end-to-end validated</span>
        </div>
        <div className="mt-2 text-[11px] text-gray-400 dark:text-gray-600">
          Network: Flare / Coston2
        </div>
      </div>
    </nav>
  );
}

// ─── Main Page Component ─────────────────────────────────────────

export default function WhitepaperPage() {
  const [activeSection, setActiveSection] = useState("executive-summary");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["background", "architecture", "flow", "liquidity"])
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Track active section on scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          // Pick the first visible entry
          const first = visible[0];
          setActiveSection(first.target.id);

          // Auto-expand parent section
          for (const section of sections) {
            if (section.subsections?.some((sub) => sub.id === first.target.id)) {
              setExpandedSections((prev) => {
                const next = new Set(Array.from(prev));
                next.add(section.id);
                return next;
              });
              break;
            }
          }
        }
      },
      {
        rootMargin: "-120px 0px -60% 0px",
        threshold: 0,
      }
    );

    // Observe all sections
    const allIds = sections.flatMap((s) => [
      s.id,
      ...(s.subsections?.map((sub) => sub.id) ?? []),
    ]);

    allIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  // Scroll to top button
  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 600);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(Array.from(prev));
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Header />

      {/* Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-gray-50 via-white to-pink-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 border-b border-gray-200/60 dark:border-gray-800/60">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-flare-pink/[0.04] blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-flare-pink/[0.03] blur-3xl" />
          <div className="absolute inset-0 grid-pattern opacity-40 dark:opacity-20" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-10">
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase bg-flare-pink/8 text-flare-pink border border-flare-pink/15">
              <FileText className="w-3 h-3" />
              Whitepaper
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase bg-emerald-500/8 text-emerald-600 dark:text-emerald-400 border border-emerald-500/15">
              v2.1
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-3">
            FLIP{" "}
            <span className="text-gradient">
              Whitepaper
            </span>
          </h1>
          <p className="text-base sm:text-lg text-gray-500 dark:text-gray-400 max-w-2xl leading-relaxed">
            Flare Liquidity Interposition Protocol — A Conditional Settlement
            Layer for Flare FAssets
          </p>
          <div className="flex flex-wrap items-center gap-4 mt-6 text-sm text-gray-400 dark:text-gray-500">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              Network: Flare / Coston2
            </span>
            <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
            <span className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              Testnet-complete
            </span>
            <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
            <span>End-to-end validated</span>
          </div>
        </div>
      </div>

      {/* Mobile sidebar toggle */}
      <div className="lg:hidden sticky top-[88px] z-40 bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg border-b border-gray-200/60 dark:border-gray-800/60">
        <div className="max-w-7xl mx-auto px-4 py-2.5">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <Menu className="w-4 h-4" />
            <span>Navigation</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-gray-400 dark:text-gray-500 truncate max-w-[200px]">
              {sections.find(
                (s) =>
                  s.id === activeSection ||
                  s.subsections?.some((sub) => sub.id === activeSection)
              )?.title ?? ""}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-[300px] bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 p-5 overflow-y-auto animate-fade-in">
            <Sidebar
              activeSection={activeSection}
              expandedSections={expandedSections}
              toggleSection={toggleSection}
              onClose={() => setSidebarOpen(false)}
              isMobile
            />
          </div>
        </div>
      )}

      {/* Main Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex gap-10">
          {/* Desktop Sidebar */}
          <aside className="hidden lg:block w-[260px] flex-shrink-0">
            <Sidebar
              activeSection={activeSection}
              expandedSections={expandedSections}
              toggleSection={toggleSection}
            />
          </aside>

          {/* Content */}
          <main
            ref={contentRef}
            className="flex-1 min-w-0 max-w-3xl"
          >
            <article className="whitepaper-content">
              {/* ═══════════ Executive Summary ═══════════ */}
              <section id="executive-summary" className="wp-section scroll-mt-32">
                <h2 className="wp-h2">Executive Summary</h2>
                <p className="wp-p">
                  FLIP is a conditional settlement acceleration protocol for Flare FAssets. It
                  enables near-instant redemptions of FXRP into XRP without weakening
                  Flare&apos;s security model. Instead of prefunded insurance or optimistic
                  settlement, FLIP uses escrowed liquidity, deterministic risk gating, and
                  Flare&apos;s State Connector (FDC) as the final arbiter of truth.
                </p>
                <Callout type="important" title="Core Principle">
                  Fast settlement is allowed only when it is provably safe. When it is not,
                  users fall back to the canonical FDC flow. The worst-case outcome is bounded
                  delay, never loss.
                </Callout>
                <p className="wp-p">
                  FLIP converts settlement risk into time, not capital loss, achieving{" "}
                  <strong>10–20× higher capital efficiency</strong> than prefunded bridges
                  while remaining fully Flare-native.
                </p>
              </section>

              <hr className="wp-divider" />

              {/* ═══════════ 1. Background ═══════════ */}
              <section id="background" className="wp-section scroll-mt-32">
                <h2 className="wp-h2">1. Background and Problem Statement</h2>

                <div id="fassets-latency" className="scroll-mt-32">
                  <h3 className="wp-h3">1.1 The FAssets Latency Problem</h3>
                  <p className="wp-p">
                    Flare&apos;s FAssets system securely brings non-smart-contract assets like XRP
                    onto Flare using the State Connector. However, redemption requires FDC
                    confirmation, which typically takes <strong>3–5 minutes</strong>.
                  </p>
                  <p className="wp-p">
                    For users and institutions, this latency creates:
                  </p>
                  <ul className="wp-list">
                    <li>Poor user experience</li>
                    <li>Price uncertainty during redemption</li>
                    <li>
                      Incompatibility with trading, payments, and market-making workflows
                    </li>
                  </ul>
                  <p className="wp-p">
                    Security is preserved, but usability is capped.
                  </p>
                </div>

                <div id="existing-solutions" className="scroll-mt-32 mt-10">
                  <h3 className="wp-h3">1.2 Why Existing Solutions Fail</h3>
                  <p className="wp-p">
                    Common approaches attempt to hide latency using:
                  </p>
                  <ul className="wp-list">
                    <li>Prefunded insurance pools</li>
                    <li>Optimistic settlement assumptions</li>
                    <li>Protocol-owned liquidity</li>
                  </ul>
                  <p className="wp-p">
                    These approaches introduce idle capital, tail-risk concentration,
                    governance complexity, and systemic insolvency risk under stress. They
                    trade trust guarantees for speed.
                  </p>
                  <Callout type="info" title="FLIP&apos;s Approach">
                    FLIP takes a different approach: it restructures settlement rather than
                    bypassing it.
                  </Callout>
                </div>
              </section>

              <hr className="wp-divider" />

              {/* ═══════════ 2. Design Principles ═══════════ */}
              <section id="design-principles" className="wp-section scroll-mt-32">
                <h2 className="wp-h2">2. Design Principles</h2>
                <p className="wp-p">
                  FLIP is built around five non-negotiable constraints:
                </p>
                <div className="my-6 space-y-3">
                  {[
                    "FDC is the final judge of truth",
                    "No standing prefunded insurance pools",
                    "All capital is opt-in and market-priced",
                    "Risk intelligence is advisory, never authoritative",
                    "Worst-case outcome is bounded delay, not loss",
                  ].map((principle, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800/60"
                    >
                      <span className="flex-shrink-0 w-6 h-6 rounded-lg bg-flare-pink/10 text-flare-pink flex items-center justify-center text-xs font-bold mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                        {principle}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="wp-p text-gray-500 dark:text-gray-400 italic">
                  Any design violating these constraints is rejected.
                </p>
              </section>

              <hr className="wp-divider" />

              {/* ═══════════ 3. Architecture ═══════════ */}
              <section id="architecture" className="wp-section scroll-mt-32">
                <h2 className="wp-h2">3. System Architecture</h2>
                <p className="wp-p">
                  FLIP consists of three tightly scoped layers.
                </p>

                <div id="on-chain" className="scroll-mt-32 mt-8">
                  <h3 className="wp-h3">3.1 On-Chain Layer (Flare)</h3>
                  <p className="wp-p">Core responsibilities:</p>
                  <ul className="wp-list">
                    <li>
                      <strong>FLIPCore</strong> — Redemption orchestration
                    </li>
                    <li>
                      <strong>EscrowVault</strong> — Conditional escrow
                    </li>
                    <li>
                      <strong>SettlementReceipt</strong> — Tokenized settlement claims
                    </li>
                    <li>
                      <strong>LiquidityProviderRegistry</strong> — Market-based liquidity routing
                    </li>
                    <li>
                      <strong>DeterministicScoring</strong> — Deterministic risk scoring
                    </li>
                  </ul>
                  <p className="wp-p wp-note">
                    All state transitions are enforced on-chain.
                  </p>
                </div>

                <div id="off-chain" className="scroll-mt-32 mt-10">
                  <h3 className="wp-h3">3.2 Off-Chain Agent Layer</h3>
                  <p className="wp-p">
                    Agents are stateless settlement executors:
                  </p>
                  <ul className="wp-list">
                    <li>Monitor escrow creation events</li>
                    <li>Send XRP payments on XRPL</li>
                    <li>Fetch FDC proofs</li>
                    <li>Submit attestations back to FLIPCore</li>
                  </ul>
                  <Callout type="warning" title="Trust Model">
                    Agents are fully untrusted. Correctness is enforced exclusively by FDC.
                  </Callout>
                </div>

                <div id="oracle-layer" className="scroll-mt-32 mt-10">
                  <h3 className="wp-h3">3.3 Oracle Layer (Advisory)</h3>
                  <p className="wp-p">
                    Oracles provide signed, advisory inputs:
                  </p>
                  <ul className="wp-list">
                    <li>Deterministic redemption scores</li>
                    <li>Suggested haircuts</li>
                    <li>Queue ordering hints</li>
                  </ul>
                  <p className="wp-p wp-note">
                    Oracles never move funds and cannot finalize settlements.
                  </p>
                </div>
              </section>

              <hr className="wp-divider" />

              {/* ═══════════ 4. End-to-End Flow ═══════════ */}
              <section id="flow" className="wp-section scroll-mt-32">
                <h2 className="wp-h2">4. End-to-End Flow</h2>

                {/* Degradation Invariant */}
                <div className="my-6 p-5 rounded-xl bg-gradient-to-br from-flare-pink/5 to-transparent border border-flare-pink/10">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2">
                    Explicit Degradation Invariant
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    FLIP guarantees liveness independent of liquidity availability.
                  </p>
                  <CodeBlock label="Invariant (Graceful Degradation)">
{`∀ redemption R,
if fast-path conditions fail or liquidity is unavailable,
R settles via canonical FDC without loss.`}
                  </CodeBlock>
                  <p className="text-xs text-gray-500 dark:text-gray-500 italic">
                    Fast settlement is an optimization layer, not a requirement. The canonical
                    FAssets redemption path is always reachable.
                  </p>
                </div>

                <div id="minting" className="scroll-mt-32 mt-10">
                  <h3 className="wp-h3">4.1 Minting (XRP → FXRP)</h3>
                  <ol className="wp-ordered-list">
                    <li>User reserves collateral via Flare AssetManager</li>
                    <li>User sends XRP on XRPL</li>
                    <li>FDC verifies payment</li>
                    <li>FXRP is minted on Flare</li>
                  </ol>
                  <p className="wp-p wp-note">
                    This is canonical Flare behavior and unchanged by FLIP.
                  </p>
                </div>

                <div id="redemption-request" className="scroll-mt-32 mt-10">
                  <h3 className="wp-h3">4.2 Redemption Request</h3>
                  <ol className="wp-ordered-list">
                    <li>User submits redemption request to FLIPCore</li>
                    <li>FXRP is locked and price is snapshotted via FTSO</li>
                    <li>Deterministic score is computed</li>
                  </ol>
                </div>

                <div id="fast-path" className="scroll-mt-32 mt-10">
                  <h3 className="wp-h3">4.3 Fast Path (High Confidence)</h3>
                  <p className="wp-p">If safety conditions are met:</p>
                  <ol className="wp-ordered-list">
                    <li>LP liquidity is escrowed</li>
                    <li>Receipt NFT is minted</li>
                    <li>Agent sends XRP immediately</li>
                    <li>User receives XRP</li>
                    <li>FDC confirms payment</li>
                    <li>Escrow is released to LP</li>
                  </ol>
                </div>

                <div id="standard-path" className="scroll-mt-32 mt-10">
                  <h3 className="wp-h3">4.4 Standard Path (Low Confidence)</h3>
                  <p className="wp-p">If conditions are not met:</p>
                  <ul className="wp-list">
                    <li>No liquidity is used</li>
                    <li>User waits for canonical FDC settlement</li>
                    <li>No haircut is applied</li>
                  </ul>
                </div>
              </section>

              <hr className="wp-divider" />

              {/* ═══════════ 5. Decision Model ═══════════ */}
              <section id="decision-model" className="wp-section scroll-mt-32">
                <h2 className="wp-h2">5. Deterministic Decision Model</h2>
                <p className="wp-p">
                  FLIP replaces ML-based prediction with a transparent scoring function.
                </p>
                <CodeBlock label="Scoring Function">
{`Score = Base × Stability × Amount × Time × Agent`}
                </CodeBlock>
                <p className="wp-p">
                  Where each multiplier is derived from on-chain or verifiable inputs. The
                  final score lies in <code className="wp-inline-code">[0, 1]</code>.
                </p>

                <h4 className="wp-h4">Fast-Path Gate</h4>
                <p className="wp-p">Fast settlement is allowed only if:</p>
                <CodeBlock label="Gate Conditions">
{`score ≥ 0.997
priceVolatility < 2%
amount ≤ maxFastAmount`}
                </CodeBlock>
                <p className="wp-p wp-note">
                  Failure of the score never causes loss, only delay.
                </p>

                <h4 className="wp-h4">Confidence Bounds (MVP)</h4>
                <CodeBlock label="Lower Bound">
{`confidenceLower = 0.98 × score`}
                </CodeBlock>
                <p className="wp-p">
                  This is a conservative bound. A conformal prediction upgrade is planned but
                  not required for safety.
                </p>
              </section>

              <hr className="wp-divider" />

              {/* ═══════════ 6. Liquidity Model ═══════════ */}
              <section id="liquidity" className="wp-section scroll-mt-32">
                <h2 className="wp-h2">6. Liquidity Model</h2>

                <div id="direct-lp" className="scroll-mt-32">
                  <h3 className="wp-h3">6.1 Direct Liquidity Providers</h3>
                  <p className="wp-p">LPs deposit FLR and specify:</p>
                  <ul className="wp-list">
                    <li>Minimum acceptable haircut</li>
                    <li>Maximum delay tolerance</li>
                  </ul>
                  <p className="wp-p">
                    LPs earn haircut fees and never underwrite tail risk.
                  </p>
                </div>

                <div id="amm-backstop" className="scroll-mt-32 mt-10">
                  <h3 className="wp-h3">6.2 AMM Backstop Liquidity</h3>
                  <p className="wp-p">
                    FLIP integrates BlazeSwap as an{" "}
                    <strong>optional, rate-limited liquidity backstop</strong>, not as a
                    primary source of liquidity.
                  </p>
                  <p className="wp-p">Key properties:</p>
                  <ul className="wp-list">
                    <li>
                      The protocol remains fully correct with the backstop disabled
                    </li>
                    <li>
                      BlazeSwap is pluggable and can be replaced by other AMMs or orderbook
                      venues
                    </li>
                    <li>Backstop usage is capped per transaction and per epoch</li>
                    <li>
                      Sustained flow is expected to be handled by direct LPs, not the backstop
                    </li>
                  </ul>
                  <Callout type="info" title="Purpose">
                    The backstop exists to prevent settlement stalls, not to absorb volume. It
                    functions as insurance against LP scarcity, not as a hidden liquidity pool.
                  </Callout>
                  <p className="wp-p">
                    When invoked, the backstop provides just-in-time liquidity via swaps and
                    immediately returns to its idle state after settlement.
                  </p>
                </div>
              </section>

              <hr className="wp-divider" />

              {/* ═══════════ 7. Escrow Math ═══════════ */}
              <section id="escrow-math" className="wp-section scroll-mt-32">
                <h2 className="wp-h2">7. Escrow and Capital Mathematics</h2>

                <h4 className="wp-h4">Safety Condition</h4>
                <p className="wp-p">Fast settlement is permitted only if:</p>
                <CodeBlock label="Safety Threshold">
{`p̂ ≥ p_min = 0.997`}
                </CodeBlock>
                <p className="wp-p">Probability of incorrect fast routing:</p>
                <CodeBlock>
{`≤ 0.3%`}
                </CodeBlock>
                <p className="wp-p wp-note">
                  Incorrect routing causes delay, not loss.
                </p>

                <h4 className="wp-h4">Expected Escrow Exposure</h4>
                <p className="wp-p">Let:</p>
                <ul className="wp-list">
                  <li>
                    <code className="wp-inline-code">λ</code> be the redemption arrival rate
                  </li>
                  <li>
                    <code className="wp-inline-code">f ∈ [0,1]</code> be the fraction of
                    redemptions routed via fast-path
                  </li>
                  <li>
                    <code className="wp-inline-code">R</code> be the redemption size
                  </li>
                  <li>
                    <code className="wp-inline-code">T_fast</code> be the escrow duration for
                    fast settlements
                  </li>
                </ul>
                <CodeBlock label="Expected Capital">
{`E[C_escrow] = λ × f × E[R] × E[T_fast]`}
                </CodeBlock>
                <p className="wp-p">
                  As risk increases, <code className="wp-inline-code">f</code> decreases
                  automatically, reducing capital usage. Since{" "}
                  <code className="wp-inline-code">E[T_fast]</code> is bounded by minutes,
                  escrow capital turns over rapidly even at high throughput.
                </p>

                <h4 className="wp-h4">LP Profitability</h4>
                <CodeBlock label="LP Profit Formula">
{`Π_LP = H × R − r × R × T`}
                </CodeBlock>
                <p className="wp-p">
                  LP participation is market-clearing and endogenous.
                </p>
              </section>

              <hr className="wp-divider" />

              {/* ═══════════ 8. Security ═══════════ */}
              <section id="security" className="wp-section scroll-mt-32">
                <h2 className="wp-h2">8. Security and Trust Model</h2>

                <h4 className="wp-h4">Agent Correctness Constraint</h4>
                <p className="wp-p">
                  Agents are execution-only and fully untrusted.
                </p>
                <CodeBlock label="Correctness Condition">
{`∀ payments P executed by an agent,
funds are released if and only if FDC(P) = true.`}
                </CodeBlock>
                <p className="wp-p">
                  An agent cannot cause loss by misbehavior. At worst, failure to act results
                  in delay until canonical settlement.
                </p>

                <h4 className="wp-h4">Global Safety Properties</h4>
                <ul className="wp-list">
                  <li>No settlement bypasses FDC</li>
                  <li>No oracle or agent can unlock funds</li>
                  <li>All funds are escrowed</li>
                  <li>All failure modes degrade to delay</li>
                </ul>

                <p className="wp-p">Formally:</p>
                <CodeBlock label="Safety Guarantees">
{`Pr(User Loss) = 0
Pr(User Delay) ≤ τ`}
                </CodeBlock>
              </section>

              <hr className="wp-divider" />

              {/* ═══════════ 9. Tokenomics ═══════════ */}
              <section id="tokenomics" className="wp-section scroll-mt-32">
                <h2 className="wp-h2">9. Tokenomics</h2>
                <Callout type="success" title="No New Token">
                  FLIP introduces no new speculative token.
                </Callout>

                <h4 className="wp-h4">Economic Tradeoffs</h4>

                <div className="my-6 space-y-4">
                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800/60">
                    <h5 className="text-xs font-bold tracking-wider uppercase text-gray-500 dark:text-gray-400 mb-2">
                      Users trade
                    </h5>
                    <ul className="wp-list !my-0">
                      <li>Potential haircut in exchange for immediacy</li>
                      <li>Guaranteed correctness in exchange for possible delay</li>
                    </ul>
                  </div>
                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800/60">
                    <h5 className="text-xs font-bold tracking-wider uppercase text-gray-500 dark:text-gray-400 mb-2">
                      Liquidity Providers trade
                    </h5>
                    <ul className="wp-list !my-0">
                      <li>Temporary capital lockup for yield</li>
                      <li>
                        Exposure limited to escrow duration, not asset price risk
                      </li>
                    </ul>
                  </div>
                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800/60">
                    <h5 className="text-xs font-bold tracking-wider uppercase text-gray-500 dark:text-gray-400 mb-2">
                      Backstop depositors trade
                    </h5>
                    <ul className="wp-list !my-0">
                      <li>Partial capital idleness for insurance-like returns</li>
                      <li>Shared exposure to short-duration escrow usage</li>
                    </ul>
                  </div>
                </div>

                <p className="wp-p wp-note">
                  These tradeoffs are explicit, opt-in, and priced by the market.
                </p>

                <h4 className="wp-h4">Value Flows</h4>
                <p className="wp-p">Value accrues via:</p>
                <ul className="wp-list">
                  <li>Haircut fees</li>
                  <li>LP yield</li>
                  <li>Agent execution fees</li>
                </ul>
                <p className="wp-p">
                  Governance is handled via Flare-native controls.
                </p>
              </section>

              <hr className="wp-divider" />

              {/* ═══════════ 10. Roadmap ═══════════ */}
              <section id="roadmap" className="wp-section scroll-mt-32">
                <h2 className="wp-h2">10. Roadmap</h2>
                <div className="my-6 space-y-0">
                  {[
                    {
                      label: "Testnet completion",
                      status: "Done",
                      color: "bg-emerald-500",
                    },
                    {
                      label: "Songbird deployment",
                      status: "Next",
                      color: "bg-flare-pink",
                    },
                    {
                      label: "Flare mainnet launch",
                      status: "Following audit",
                      color: "bg-gray-300 dark:bg-gray-600",
                    },
                    {
                      label: "Conformal confidence upgrade",
                      status: "Post-launch",
                      color: "bg-gray-300 dark:bg-gray-600",
                    },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-4 relative">
                      {/* Timeline line */}
                      {i < 3 && (
                        <div className="absolute left-[11px] top-7 w-0.5 h-full bg-gray-200 dark:bg-gray-800" />
                      )}
                      {/* Dot */}
                      <div
                        className={`w-6 h-6 rounded-full ${item.color} flex-shrink-0 mt-0.5 flex items-center justify-center z-10`}
                      >
                        {item.status === "Done" && (
                          <Check className="w-3.5 h-3.5 text-white" />
                        )}
                      </div>
                      {/* Text */}
                      <div className="pb-8">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {item.label}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {item.status}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <hr className="wp-divider" />

              {/* ═══════════ 11. Comparison ═══════════ */}
              <section id="comparison" className="wp-section scroll-mt-32">
                <h2 className="wp-h2">11. Comparison: FLIP vs Firelight</h2>
                <div className="my-6 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700/60">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800/60">
                        <th className="text-left px-5 py-3 font-semibold text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700/60">
                          Dimension
                        </th>
                        <th className="text-left px-5 py-3 font-semibold text-flare-pink border-b border-gray-200 dark:border-gray-700/60">
                          FLIP
                        </th>
                        <th className="text-left px-5 py-3 font-semibold text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700/60">
                          Firelight
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                      {[
                        ["Capital model", "Conditional escrow", "Prefunded insurance"],
                        ["Tail risk", "None", "Concentrated"],
                        ["Trust assumptions", "FDC-only", "External guarantees"],
                        ["Failure mode", "Delay", "Insolvency risk"],
                        ["Capital efficiency", "High", "Low"],
                      ].map(([dim, flip, fire], i) => (
                        <tr
                          key={i}
                          className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                        >
                          <td className="px-5 py-3 font-medium text-gray-700 dark:text-gray-300">
                            {dim}
                          </td>
                          <td className="px-5 py-3 text-flare-pink font-semibold">
                            {flip}
                          </td>
                          <td className="px-5 py-3 text-gray-500 dark:text-gray-400">
                            {fire}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Callout type="important" title="Key Insight">
                  FLIP is not faster by trusting more. It is faster by structuring risk
                  correctly.
                </Callout>
              </section>

              <hr className="wp-divider" />

              {/* ═══════════ 12. Conclusion ═══════════ */}
              <section id="conclusion" className="wp-section scroll-mt-32">
                <h2 className="wp-h2">12. Conclusion</h2>
                <p className="wp-p">
                  FLIP transforms FAssets into an institution-grade settlement primitive
                  without compromising Flare&apos;s security model. By replacing insurance with
                  escrow, prediction with deterministic gating, and trust with verification,
                  FLIP unlocks speed while preserving correctness.
                </p>
                <div className="my-8 p-6 rounded-2xl bg-gradient-to-br from-flare-pink/5 via-transparent to-flare-pink/3 border border-flare-pink/10">
                  <p className="text-lg font-bold text-gray-900 dark:text-white text-center">
                    This is not an optimization.{" "}
                    <span className="text-gradient">It is a structural upgrade.</span>
                  </p>
                </div>
              </section>

              <hr className="wp-divider" />

              {/* ═══════════ Legal ═══════════ */}
              <section id="disclaimer" className="wp-section scroll-mt-32">
                <h2 className="wp-h2">Legal Disclaimer</h2>
                <p className="wp-p text-gray-500 dark:text-gray-400 text-xs leading-relaxed">
                  This document is for informational purposes only. Nothing herein
                  constitutes financial advice, investment solicitation, or a guarantee of
                  performance. All systems are subject to risk, including smart contract risk,
                  network risk, and external dependencies.
                </p>
              </section>
            </article>
          </main>
        </div>
      </div>

      {/* Scroll to top */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 z-50 p-3 rounded-xl bg-flare-pink text-white shadow-pink hover:shadow-pink-lg hover:-translate-y-0.5 transition-all duration-300 animate-fade-in"
        >
          <ArrowUp className="w-4.5 h-4.5" />
        </button>
      )}
    </div>
  );
}
