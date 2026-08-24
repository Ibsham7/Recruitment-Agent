import { useState, useRef, useEffect, useCallback } from "react";
import { gsap } from "gsap";
import { X, Menu } from "lucide-react";
import "./common.css";

export interface PillNavItem {
  label: string;
  onClick?: () => void;
  active?: boolean;
}

export function PillNav({
  items,
  containerStyle,
  ease = "power3.easeOut",
  baseColor = "#fff",
  pillColor = "#120F17",
  hoveredPillTextColor = "#120F17",
  pillTextColor,
  className = "",
}: {
  items: PillNavItem[];
  containerStyle?: React.CSSProperties;
  ease?: string;
  baseColor?: string;
  pillColor?: string;
  hoveredPillTextColor?: string;
  pillTextColor?: string;
  className?: string;
}) {
  const resolvedPillText = pillTextColor ?? baseColor;
  const [mobileOpen, setMobileOpen] = useState(false);
  const circleRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const tlRefs = useRef<(gsap.core.Timeline | null)[]>([]);
  const activeTweenRefs = useRef<(gsap.core.Tween | null)[]>([]);
  const navItemsRef = useRef<HTMLDivElement>(null);

  const closeMobile = useCallback(() => {
    setMobileOpen(false);
  }, []);

  // Keyboard dismissal (Escape key) & Body scroll lock
  useEffect(() => {
    if (!mobileOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeMobile();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [mobileOpen, closeMobile]);

  // Layout and GSAP hover animations for desktop pills
  useEffect(() => {
    const layout = () => {
      circleRefs.current.forEach((circle, index) => {
        if (!circle?.parentElement) return;
        const pill = circle.parentElement;
        const { width: w, height: h } = pill.getBoundingClientRect();
        if (w === 0 || h === 0) return;
        const R = ((w * w) / 4 + h * h) / (2 * h);
        const D = Math.ceil(2 * R) + 2;
        const delta = Math.ceil(R - Math.sqrt(Math.max(0, R * R - (w * w) / 4))) + 1;
        const originY = D - delta;
        circle.style.width = `${D}px`;
        circle.style.height = `${D}px`;
        circle.style.bottom = `-${delta}px`;
        gsap.set(circle, { xPercent: -50, scale: 0, transformOrigin: `50% ${originY}px` });
        const label = pill.querySelector(".pill-label");
        const hover = pill.querySelector(".pill-label-hover");
        if (label) gsap.set(label, { y: 0 });
        if (hover) gsap.set(hover, { y: h + 12, opacity: 0 });
        tlRefs.current[index]?.kill();
        const tl = gsap.timeline({ paused: true });
        tl.to(circle, { scale: 1.2, xPercent: -50, duration: 2, ease, overwrite: "auto" }, 0);
        if (label) tl.to(label, { y: -(h + 8), duration: 2, ease, overwrite: "auto" }, 0);
        if (hover) {
          gsap.set(hover, { y: Math.ceil(h + 100), opacity: 0 });
          tl.to(hover, { y: 0, opacity: 1, duration: 2, ease, overwrite: "auto" }, 0);
        }
        tlRefs.current[index] = tl;
      });
    };

    layout();
    window.addEventListener("resize", layout, { passive: true });
    document.fonts?.ready?.then(layout).catch(() => {});

    return () => {
      window.removeEventListener("resize", layout);
      tlRefs.current.forEach(tl => tl?.kill());
      activeTweenRefs.current.forEach(tw => tw?.kill());
    };
  }, [items, ease]);

  const handleEnter = (i: number) => {
    const tl = tlRefs.current[i];
    if (!tl) return;
    activeTweenRefs.current[i]?.kill();
    activeTweenRefs.current[i] = tl.tweenTo(tl.duration(), { duration: 0.3, ease, overwrite: "auto" });
  };

  const handleLeave = (i: number) => {
    const tl = tlRefs.current[i];
    if (!tl) return;
    activeTweenRefs.current[i]?.kill();
    activeTweenRefs.current[i] = tl.tweenTo(0, { duration: 0.2, ease, overwrite: "auto" });
  };

  const cssVars = {
    "--base": baseColor,
    "--pill-bg": pillColor,
    "--hover-text": hoveredPillTextColor,
    "--pill-text": resolvedPillText,
  } as React.CSSProperties;

  return (
    <div className={`pill-nav-container ${className}`} style={containerStyle}>
      <nav className="pill-nav" style={cssVars} aria-label="Navigation">
        <div className="pill-nav-items" ref={navItemsRef}>
          <ul className="pill-list" role="menubar">
            {items.map((item, i) => (
              <li key={i} role="none">
                <button
                  type="button"
                  role="menuitem"
                  className={`cursor-target pill${item.active ? " is-active" : ""}`}
                  onMouseEnter={() => handleEnter(i)}
                  onMouseLeave={() => handleLeave(i)}
                  onClick={item.onClick}
                >
                  <span className="hover-circle" aria-hidden="true" ref={(el) => { circleRefs.current[i] = el; }} />
                  <span className="label-stack">
                    <span className="pill-label">{item.label}</span>
                    <span className="pill-label-hover" aria-hidden="true">{item.label}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Mobile menu trigger button (>=44x44px touch target) */}
        <button
          type="button"
          className="cursor-target mobile-menu-button min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl p-2.5 transition-transform active:scale-95"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle navigation menu"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="w-5 h-5 text-current" /> : <Menu className="w-5 h-5 text-current" />}
        </button>
      </nav>

      {/* Standalone Mobile Menu Drawer / Modal Backdrop adhering to Modal UX Rules */}
      {mobileOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Navigation Menu"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
          onClick={closeMobile} // Rule 2: Backdrop Click-to-Close
        >
          {/* Inner Dialog Box (stopPropagation so clicks inside do not close) */}
          <div
            className="w-full max-w-sm rounded-3xl p-5 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
            style={{
              background: baseColor,
              border: `1px solid rgba(255, 255, 255, 0.15)`,
              color: resolvedPillText,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Rule 1: Sticky Header & Fixed Controls */}
            <div className="shrink-0 z-10 flex items-center justify-between pb-4 mb-2 border-b border-white/10">
              <span className="text-sm font-bold tracking-wide uppercase opacity-80">Menu</span>
              <button
                type="button"
                onClick={closeMobile}
                className="min-w-[44px] min-h-[44px] w-11 h-11 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-current cursor-pointer"
                aria-label="Close menu"
              >
                <X className="w-5 h-5 stroke-[2.2]" />
              </button>
            </div>

            {/* Rule 4: Independent Scroll Body */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {items.map((item, i) => (
                <button
                  key={i}
                  type="button"
                  className={`w-full min-h-[44px] px-4 py-3 rounded-2xl text-left font-medium text-sm transition-all flex items-center justify-between cursor-pointer hover:bg-white/10 active:scale-[0.98] ${
                    item.active ? "bg-white/15 font-semibold" : ""
                  }`}
                  style={{
                    background: item.active ? "rgba(255, 255, 255, 0.15)" : pillColor,
                    color: resolvedPillText,
                  }}
                  onClick={() => {
                    item.onClick?.();
                    closeMobile();
                  }}
                >
                  <span>{item.label}</span>
                  {item.active && <span className="w-2 h-2 rounded-full bg-current shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
