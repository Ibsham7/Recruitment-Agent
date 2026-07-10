import { useState, useRef, useEffect } from "react";
import { gsap } from "gsap";
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
  pillTextColor
}: {
  items: PillNavItem[];
  containerStyle?: React.CSSProperties;
  ease?: string;
  baseColor?: string;
  pillColor?: string;
  hoveredPillTextColor?: string;
  pillTextColor?: string;
}) {
  const resolvedPillText = pillTextColor ?? baseColor;
  const [mobileOpen, setMobileOpen] = useState(false);
  const circleRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const tlRefs = useRef<(gsap.core.Timeline | null)[]>([]);
  const activeTweenRefs = useRef<(gsap.core.Tween | null)[]>([]);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const navItemsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const layout = () => {
      circleRefs.current.forEach((circle, index) => {
        if (!circle?.parentElement) return;
        const pill = circle.parentElement;
        const { width: w, height: h } = pill.getBoundingClientRect();
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
        if (hover) { gsap.set(hover, { y: Math.ceil(h + 100), opacity: 0 }); tl.to(hover, { y: 0, opacity: 1, duration: 2, ease, overwrite: "auto" }, 0); }
        tlRefs.current[index] = tl;
      });
    };
    layout();
    window.addEventListener("resize", layout);
    document.fonts?.ready?.then(layout).catch(() => {});
    const menu = mobileMenuRef.current;
    if (menu) gsap.set(menu, { visibility: "hidden", opacity: 0 });
    return () => window.removeEventListener("resize", layout);
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

  const toggleMobile = () => {
    const next = !mobileOpen;
    setMobileOpen(next);
    const hb = hamburgerRef.current;
    const menu = mobileMenuRef.current;
    if (hb) {
      const lines = hb.querySelectorAll<HTMLElement>(".hamburger-line");
      if (next) { gsap.to(lines[0], { rotation: 45, y: 3, duration: 0.3, ease }); gsap.to(lines[1], { rotation: -45, y: -3, duration: 0.3, ease }); }
      else { gsap.to(lines[0], { rotation: 0, y: 0, duration: 0.3, ease }); gsap.to(lines[1], { rotation: 0, y: 0, duration: 0.3, ease }); }
    }
    if (menu) {
      if (next) { gsap.set(menu, { visibility: "visible" }); gsap.fromTo(menu, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.3, ease }); }
      else { gsap.to(menu, { opacity: 0, y: 10, duration: 0.2, ease, onComplete: () => gsap.set(menu, { visibility: "hidden" }) }); }
    }
  };

  const cssVars = { "--base": baseColor, "--pill-bg": pillColor, "--hover-text": hoveredPillTextColor, "--pill-text": resolvedPillText } as React.CSSProperties;

  return (
    <div className="pill-nav-container" style={containerStyle}>
      <nav className="pill-nav" style={cssVars}>
        <div className="pill-nav-items" ref={navItemsRef}>
          <ul className="pill-list" role="menubar">
            {items.map((item, i) => (
              <li key={i} role="none">
                <button role="menuitem"
                  className={`pill${item.active ? " is-active" : ""}`}
                  onMouseEnter={() => handleEnter(i)}
                  onMouseLeave={() => handleLeave(i)}
                  onClick={item.onClick}>
                  <span className="hover-circle" aria-hidden="true" ref={el => { circleRefs.current[i] = el; }} />
                  <span className="label-stack">
                    <span className="pill-label">{item.label}</span>
                    <span className="pill-label-hover" aria-hidden="true">{item.label}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <button className="mobile-menu-button" onClick={toggleMobile} aria-label="Toggle menu" ref={hamburgerRef}>
          <span className="hamburger-line" /><span className="hamburger-line" />
        </button>
      </nav>
      <div className="mobile-menu-popover" ref={mobileMenuRef} style={cssVars}>
        <ul className="mobile-menu-list">
          {items.map((item, i) => (
            <li key={i}>
              <button className={`mobile-menu-link${item.active ? " is-active" : ""}`}
                onClick={() => { item.onClick?.(); setMobileOpen(false); }}>
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
