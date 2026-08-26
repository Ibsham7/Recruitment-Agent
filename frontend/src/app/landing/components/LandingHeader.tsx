import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Menu, X, Sparkles, Cpu, DollarSign, HelpCircle, LogIn, ArrowRight, ChevronRight } from "lucide-react";
import { Theme } from "../../../lib/types";
import { hexToRgba } from "../../../lib/theme";
import { PillNav } from "../../../components/common/PillNav";

interface LandingHeaderProps {
  theme: Theme;
  onEnter: () => void;
  logoLightImg: string;
  logoDarkImg: string;
}

interface NavItem {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}

interface MobileNavDrawerProps {
  open: boolean;
  onClose: () => void;
  theme: Theme;
  onEnter: () => void;
  logoLightImg: string;
  logoDarkImg: string;
  navItems: NavItem[];
}

// Dedicated Mobile Drawer Subcomponent following Modal & Drawer UX Best Practices
function MobileNavDrawer({
  open,
  onClose,
  theme: t,
  onEnter,
  logoLightImg,
  logoDarkImg,
  navItems,
}: MobileNavDrawerProps) {
  // Keyboard dismissal (Escape key) & Body scroll lock
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mobile Navigation Menu"
      className="fixed inset-0 z-[100] flex justify-end transition-opacity duration-200"
      style={{
        background: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
      onClick={onClose} // Rule 2: Backdrop Click-to-Close
    >
      {/* Inner Drawer Dialog Box (stopPropagation so clicking inside does not dismiss) */}
      <div
        className="w-full max-w-sm sm:max-w-md h-full flex flex-col shadow-2xl border-l overflow-hidden transition-transform duration-300"
        style={{
          background: hexToRgba(t.bgPage, t.isDark ? 0.97 : 0.98),
          borderColor: hexToRgba(t.txtBody, t.isDark ? 0.14 : 0.1),
          color: t.txtBody,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Rule 1: Sticky Header & Fixed Controls (pinned to top) */}
        <div
          className="shrink-0 z-10 px-5 py-4 flex items-center justify-between border-b"
          style={{
            borderColor: hexToRgba(t.txtBody, t.isDark ? 0.08 : 0.06),
            background: hexToRgba(t.bgPage, t.isDark ? 0.95 : 0.98),
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          <div className="flex items-center">
            <img
              src={t.isDark ? logoDarkImg : logoLightImg}
              alt="AgenticHR logo"
              width={120}
              height={32}
              loading="lazy"
              decoding="async"
              style={{ aspectRatio: "120 / 32" }}
              className="h-7 w-auto object-contain object-left select-none"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] w-11 h-11 flex items-center justify-center rounded-xl transition-all hover:scale-105 active:scale-95 cursor-pointer"
            style={{
              background: hexToRgba(t.bgCard, t.isDark ? 0.3 : 0.6),
              border: `1px solid ${hexToRgba(t.txtBody, t.isDark ? 0.12 : 0.1)}`,
              color: t.txtBody,
            }}
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5 stroke-[2.2]" />
          </button>
        </div>

        {/* Rule 4: Independent Scroll Body (flex-1 overflow-y-auto) */}
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
          {/* Navigation Items Section */}
          <div className="space-y-2">
            <p
              className="text-[11px] font-bold uppercase tracking-wider px-2 mb-2"
              style={{ color: t.txtMuted }}
            >
              Navigation
            </p>
            {navItems.map((item, idx) => {
              const Icon = item.icon;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={item.onClick}
                  className="w-full min-h-[52px] px-3.5 py-3 rounded-2xl flex items-center justify-between transition-all hover:scale-[1.01] active:scale-[0.99] text-left group cursor-pointer"
                  style={{
                    background: hexToRgba(t.bgCard, t.isDark ? 0.16 : 0.45),
                    border: `1px solid ${hexToRgba(t.txtBody, t.isDark ? 0.08 : 0.05)}`,
                  }}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background: hexToRgba(t.accentPrimary, t.isDark ? 0.18 : 0.12),
                        color: t.accentPrimary,
                      }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate" style={{ color: t.txtBody }}>
                        {item.label}
                      </div>
                      <div className="text-xs truncate" style={{ color: t.txtMuted }}>
                        {item.description}
                      </div>
                    </div>
                  </div>
                  <ChevronRight
                    className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                    style={{ color: t.txtMuted }}
                  />
                </button>
              );
            })}
          </div>

          {/* Account / Dashboard Section */}
          <div className="space-y-2 pt-2 border-t" style={{ borderColor: hexToRgba(t.txtBody, t.isDark ? 0.08 : 0.06) }}>
            <p
              className="text-[11px] font-bold uppercase tracking-wider px-2 mb-2"
              style={{ color: t.txtMuted }}
            >
              Account
            </p>
            <button
              type="button"
              onClick={() => {
                onClose();
                onEnter();
              }}
              className="w-full min-h-[48px] px-4 py-3 rounded-2xl flex items-center justify-between text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
              style={{
                background: hexToRgba(t.bgCard, t.isDark ? 0.22 : 0.5),
                border: `1px solid ${hexToRgba(t.txtBody, t.isDark ? 0.1 : 0.07)}`,
                color: t.txtBody,
              }}
            >
              <div className="flex items-center gap-3">
                <LogIn className="w-4 h-4" style={{ color: t.accentPrimary }} />
                <span>Sign In to Dashboard</span>
              </div>
              <ChevronRight className="w-4 h-4" style={{ color: t.txtMuted }} />
            </button>
          </div>

          {/* Quick Status / Engine Telemetry Badge */}
          <div
            className="p-3.5 rounded-2xl flex items-center gap-3"
            style={{
              background: hexToRgba(t.accentPrimary, t.isDark ? 0.1 : 0.06),
              border: `1px solid ${hexToRgba(t.accentPrimary, t.isDark ? 0.2 : 0.15)}`,
            }}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <div className="text-xs">
              <span className="font-semibold block" style={{ color: t.txtBody }}>
                Autonomous AI Engine v2.4
              </span>
              <span className="block text-[11px]" style={{ color: t.txtMuted }}>
                99.4% Anti-Cheat • Real-time Telemetry
              </span>
            </div>
          </div>
        </div>

        {/* Rule 1: Sticky Fixed Footer with Primary CTA (pinned to bottom) */}
        <div
          className="shrink-0 p-5 border-t"
          style={{
            borderColor: hexToRgba(t.txtBody, t.isDark ? 0.08 : 0.06),
            background: hexToRgba(t.bgPage, t.isDark ? 0.95 : 0.98),
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          <button
            type="button"
            onClick={() => {
              onClose();
              onEnter();
            }}
            className="w-full min-h-[48px] py-3.5 px-5 rounded-2xl text-sm font-bold text-center flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.98] cursor-pointer shadow-lg"
            style={{
              background: `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.82)})`,
              color: t.accentText,
              boxShadow: `0 4px 16px ${hexToRgba(t.accentPrimary, 0.4)}`,
            }}
          >
            <span>Get started now</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function LandingHeader({ theme: t, onEnter, logoLightImg, logoDarkImg }: LandingHeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeDrawer = useCallback(() => {
    setMobileOpen(false);
  }, []);

  // Close mobile drawer on desktop resize with passive listener
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768 && mobileOpen) {
        setMobileOpen(false);
      }
    };
    window.addEventListener("resize", handleResize, { passive: true });
    return () => window.removeEventListener("resize", handleResize);
  }, [mobileOpen]);

  const handleNavClick = useCallback((sectionId: string) => {
    setMobileOpen(false);
    // Allow drawer close animation before scrolling
    setTimeout(() => {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    }, 100);
  }, []);

  const navItems = useMemo<NavItem[]>(() => [
    {
      label: "Features",
      description: "AI Interviewer, Anti-Cheat & Live Telemetry",
      icon: Sparkles,
      onClick: () => handleNavClick("ha-features"),
    },
    {
      label: "How it works",
      description: "4-step autonomous recruiting engine",
      icon: Cpu,
      onClick: () => handleNavClick("ha-process"),
    },
    {
      label: "Pricing",
      description: "Credit top-ups & ROI simulator",
      icon: DollarSign,
      onClick: () => handleNavClick("ha-pricing"),
    },
    {
      label: "FAQ",
      description: "Questions, compliance & enterprise wizard",
      icon: HelpCircle,
      onClick: () => handleNavClick("ha-faq"),
    },
  ], [handleNavClick]);

  // Memoize PillNav items so PillNav doesn't re-run GSAP layout & getBoundingClientRect on every header render
  const pillNavItems = useMemo(() => [
    { label: "Features", onClick: () => document.getElementById("ha-features")?.scrollIntoView({ behavior: "smooth" }) },
    { label: "How it works", onClick: () => document.getElementById("ha-process")?.scrollIntoView({ behavior: "smooth" }) },
    { label: "Pricing", onClick: () => document.getElementById("ha-pricing")?.scrollIntoView({ behavior: "smooth" }) },
    { label: "FAQ", onClick: () => document.getElementById("ha-faq")?.scrollIntoView({ behavior: "smooth" }) },
    { label: "Sign in", onClick: onEnter },
  ], [onEnter]);

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 h-16 md:h-[72px]"
        style={{
          background: hexToRgba(t.bgPage, t.isDark ? 0.82 : 0.88),
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: `1px solid ${hexToRgba(t.txtBody, t.isDark ? 0.08 : 0.06)}`,
        }}
      >
        <div className="w-full h-full px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 flex items-center justify-between gap-2 sm:gap-4">
          {/* Brand Logo with Smooth Scroll to Top */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="flex items-center min-h-[44px] cursor-pointer bg-transparent border-0 p-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 rounded-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
              aria-label="AgenticHR Home"
            >
              <img
                src={t.isDark ? logoDarkImg : logoLightImg}
                alt="AgenticHR logo"
                width={140}
                height={38}
                loading="eager"
                decoding="async"
                className="h-7 sm:h-8 md:h-9 w-auto max-w-[125px] sm:max-w-[150px] object-contain object-left select-none"
                style={{ aspectRatio: "140 / 38" }}
              />
            </button>
          </div>

          {/* Desktop Center PillNav (hidden on < 768px) */}
          <div className="hidden md:flex items-center justify-center flex-1 min-w-0">
            <PillNav
              containerStyle={{ position: "relative", top: "unset" }}
              baseColor={t.isDark ? hexToRgba(t.bgSurface, 0.88) : hexToRgba(t.txtBody, 0.88)}
              pillColor={t.isDark ? hexToRgba(t.bgCard, 0.16) : hexToRgba(t.bgCard, 0.92)}
              pillTextColor={t.isDark ? t.txtBody : t.txtBody}
              hoveredPillTextColor={t.isDark ? t.bgPage : t.bgPage}
              items={pillNavItems}
            />
          </div>

          {/* Header Action Buttons (CTA & Mobile Menu Trigger) */}
          <div className="flex items-center justify-end shrink-0 gap-2 sm:gap-3">
            {/* Mobile Compact CTA (visible < 768px, min touch target >= 44x44px) */}
            <button
              onClick={onEnter}
              type="button"
              className="md:hidden min-h-[44px] min-w-[44px] px-3.5 sm:px-4 py-2.5 rounded-xl text-xs font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center shrink-0 cursor-pointer select-none"
              style={{
                background: `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.78)})`,
                color: t.accentText,
                boxShadow: `0 2px 10px ${hexToRgba(t.accentPrimary, 0.35)}`,
              }}
              aria-label="Get started"
            >
              <span className="whitespace-nowrap">Get started</span>
            </button>

            {/* Desktop CTA (visible >= 768px, min touch target >= 44px) */}
            <button
              onClick={onEnter}
              type="button"
              className="hidden md:flex min-h-[44px] px-5 py-2.5 rounded-xl text-xs font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] items-center justify-center shrink-0 cursor-pointer select-none"
              style={{
                background: `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.78)})`,
                color: t.accentText,
                boxShadow: `0 2px 12px ${hexToRgba(t.accentPrimary, 0.35)}`,
              }}
            >
              Get started →
            </button>

            {/* Mobile Hamburger Trigger (>= 44x44px touch target) */}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="md:hidden min-w-[44px] min-h-[44px] w-11 h-11 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer select-none focus:outline-none"
              style={{
                background: hexToRgba(t.bgCard, t.isDark ? 0.28 : 0.65),
                border: `1px solid ${hexToRgba(t.txtBody, t.isDark ? 0.14 : 0.12)}`,
                color: t.txtBody,
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              }}
              aria-label="Open navigation menu"
              aria-expanded={mobileOpen}
            >
              <Menu className="w-5 h-5 stroke-[2.2]" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Drawer Subcomponent */}
      <MobileNavDrawer
        open={mobileOpen}
        onClose={closeDrawer}
        theme={t}
        onEnter={onEnter}
        logoLightImg={logoLightImg}
        logoDarkImg={logoDarkImg}
        navItems={navItems}
      />
    </>
  );
}

