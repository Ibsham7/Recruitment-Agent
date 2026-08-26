import { Theme } from "../../../lib/types";
import { hexToRgba } from "../../../lib/theme";
import { Github, Twitter, Linkedin } from "lucide-react";

interface LandingFooterProps {
  theme: Theme;
  onEnter: () => void;
  logoLightImg: string;
  logoDarkImg: string;
}

export function LandingFooter({ theme: t, onEnter, logoLightImg, logoDarkImg }: LandingFooterProps) {
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <footer
      className="relative z-10 w-full max-w-full pt-12 sm:pt-16 pb-8 sm:pb-12 px-4 sm:px-8 border-t overflow-hidden"
      style={{
        borderColor: hexToRgba(t.txtBody, 0.08),
        background: hexToRgba(t.bgSurface, t.isDark ? 0.50 : 0.30)
      }}
    >
      <div className="max-w-6xl mx-auto">
        {/* Main 4-column responsive grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 sm:gap-10 mb-10 sm:mb-12">
          {/* Column 1: Brand & Status & Socials */}
          <div className="flex flex-col items-start sm:col-span-2 md:col-span-1">
            <img
              src={t.isDark ? logoDarkImg : logoLightImg}
              alt="AgenticHR logo"
              width={130}
              height={40}
              className="mb-4 h-8 w-auto object-contain"
            />
            <p className="text-xs sm:text-sm leading-relaxed mb-4 max-w-xs" style={{ color: t.txtSecondary }}>
              Exponentially narrowing, ultra-cost-optimized AI screening & automated candidate interview engine.
            </p>
            
            <div
              role="status"
              aria-label="All Systems Operational"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-medium mb-5"
              style={{ background: hexToRgba(t.accentBadge, 0.12), color: t.accentBadge }}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" aria-hidden="true" />
              <span>All Systems Operational</span>
            </div>

            {/* Social Icons with >= 44x44px touch targets */}
            <div className="flex items-center gap-2">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="AgenticHR on GitHub"
                className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center border transition-all duration-200 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{
                  background: hexToRgba(t.bgCard, t.isDark ? 0.12 : 0.50),
                  borderColor: hexToRgba(t.txtBody, 0.12),
                  color: t.txtPrimary
                }}
              >
                <Github className="w-4 h-4" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="AgenticHR on Twitter"
                className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center border transition-all duration-200 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{
                  background: hexToRgba(t.bgCard, t.isDark ? 0.12 : 0.50),
                  borderColor: hexToRgba(t.txtBody, 0.12),
                  color: t.txtPrimary
                }}
              >
                <Twitter className="w-4 h-4" />
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="AgenticHR on LinkedIn"
                className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center border transition-all duration-200 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{
                  background: hexToRgba(t.bgCard, t.isDark ? 0.12 : 0.50),
                  borderColor: hexToRgba(t.txtBody, 0.12),
                  color: t.txtPrimary
                }}
              >
                <Linkedin className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Column 2: Product */}
          <nav aria-label="Product navigation">
            <h4
              className="text-xs font-bold uppercase tracking-wider mb-2 sm:mb-3"
              style={{ color: t.txtPrimary, fontFamily: "'DM Mono', monospace" }}
            >
              Product
            </h4>
            <ul className="space-y-0.5 text-xs">
              <li>
                <button
                  type="button"
                  onClick={() => scrollTo("ha-features")}
                  className="min-h-[44px] w-full text-left inline-flex items-center hover:underline focus-visible:outline-none transition-colors"
                  style={{ color: t.txtSecondary }}
                >
                  Features
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollTo("ha-process")}
                  className="min-h-[44px] w-full text-left inline-flex items-center hover:underline focus-visible:outline-none transition-colors"
                  style={{ color: t.txtSecondary }}
                >
                  How It Works
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollTo("ha-pricing")}
                  className="min-h-[44px] w-full text-left inline-flex items-center hover:underline focus-visible:outline-none transition-colors"
                  style={{ color: t.txtSecondary }}
                >
                  Pricing & Simulator
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onEnter}
                  className="min-h-[44px] w-full text-left inline-flex items-center hover:underline focus-visible:outline-none transition-colors"
                  style={{ color: t.txtSecondary }}
                >
                  Dashboard Access
                </button>
              </li>
            </ul>
          </nav>

          {/* Column 3: Architecture */}
          <nav aria-label="Architecture navigation">
            <h4
              className="text-xs font-bold uppercase tracking-wider mb-2 sm:mb-3"
              style={{ color: t.txtPrimary, fontFamily: "'DM Mono', monospace" }}
            >
              Architecture
            </h4>
            <ul className="space-y-0.5 text-xs">
              <li>
                <button
                  type="button"
                  onClick={() => scrollTo("ha-faq")}
                  className="min-h-[44px] w-full text-left inline-flex items-center hover:underline focus-visible:outline-none transition-colors"
                  style={{ color: t.txtSecondary }}
                >
                  FAQ & Questions
                </button>
              </li>
              <li>
                <a
                  href="#ha-features"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollTo("ha-features");
                  }}
                  className="min-h-[44px] w-full text-left inline-flex items-center hover:underline focus-visible:outline-none transition-colors"
                  style={{ color: t.txtSecondary }}
                >
                  Multi-Tier Screening
                </a>
              </li>
              <li>
                <a
                  href="#ha-process"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollTo("ha-process");
                  }}
                  className="min-h-[44px] w-full text-left inline-flex items-center hover:underline focus-visible:outline-none transition-colors"
                  style={{ color: t.txtSecondary }}
                >
                  Vector Semantic Match
                </a>
              </li>
              <li>
                <a
                  href="#ha-features"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollTo("ha-features");
                  }}
                  className="min-h-[44px] w-full text-left inline-flex items-center hover:underline focus-visible:outline-none transition-colors"
                  style={{ color: t.txtSecondary }}
                >
                  Anti-Cheat Telemetry
                </a>
              </li>
            </ul>
          </nav>

          {/* Column 4: Security & Data */}
          <nav aria-label="Security and legal navigation">
            <h4
              className="text-xs font-bold uppercase tracking-wider mb-2 sm:mb-3"
              style={{ color: t.txtPrimary, fontFamily: "'DM Mono', monospace" }}
            >
              Security & Data
            </h4>
            <ul className="space-y-0.5 text-xs">
              <li>
                <a
                  href="/privacy"
                  className="min-h-[44px] w-full text-left inline-flex items-center hover:underline focus-visible:outline-none transition-colors"
                  style={{ color: t.txtSecondary }}
                >
                  Candidate Data Privacy
                </a>
              </li>
              <li>
                <a
                  href="/terms"
                  className="min-h-[44px] w-full text-left inline-flex items-center hover:underline focus-visible:outline-none transition-colors"
                  style={{ color: t.txtSecondary }}
                >
                  Terms of Service
                </a>
              </li>
              <li>
                <a
                  href="/privacy#sec-subprocessors"
                  className="min-h-[44px] w-full text-left inline-flex items-center hover:underline focus-visible:outline-none transition-colors"
                  style={{ color: t.txtSecondary }}
                >
                  Data Sub-Processors
                </a>
              </li>
            </ul>
          </nav>
        </div>

        {/* Responsive bottom copyright & legal links row: stack on mobile, row on sm+ */}
        <div
          className="pt-6 sm:pt-8 border-t flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] sm:text-xs text-center sm:text-left"
          style={{
            borderColor: hexToRgba(t.txtBody, 0.06),
            color: t.txtGhost,
            fontFamily: "'DM Mono', monospace"
          }}
        >
          <span>© 2026 AgenticHR. All rights reserved.</span>
          <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-3">
            <a
              href="/privacy"
              className="min-h-[44px] px-2 inline-flex items-center hover:underline transition-colors focus-visible:outline-none"
              style={{ color: t.txtSecondary }}
            >
              Privacy Policy
            </a>
            <span className="hidden sm:inline opacity-30">•</span>
            <a
              href="/terms"
              className="min-h-[44px] px-2 inline-flex items-center hover:underline transition-colors focus-visible:outline-none"
              style={{ color: t.txtSecondary }}
            >
              Terms of Service
            </a>
            <span className="hidden sm:inline opacity-30">•</span>
            <a
              href="/privacy#sec-subprocessors"
              className="min-h-[44px] px-2 inline-flex items-center hover:underline transition-colors focus-visible:outline-none"
              style={{ color: t.txtSecondary }}
            >
              Security
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
