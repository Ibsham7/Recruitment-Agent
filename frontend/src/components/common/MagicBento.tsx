import { useEffect, useRef, useCallback } from "react";
import { gsap } from "gsap";
import "./common.css";

export interface ParticleCardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  glowColor?: string;
  particleCount?: number;
  enableTilt?: boolean;
  clickEffect?: boolean;
  enableMagnetism?: boolean;
}

export function ParticleCard({
  children, className = "", style, onClick,
  glowColor = "128,128,128",
  particleCount = 10,
  enableTilt = true,
  clickEffect = true,
  enableMagnetism = true,
}: ParticleCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<HTMLElement[]>([]);
  const timeoutsRef = useRef<number[]>([]);
  const isHoveredRef = useRef(false);
  const magnetRef = useRef<gsap.core.Tween | null>(null);

  const clearParticles = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    magnetRef.current?.kill();
    particlesRef.current.forEach(p => {
      gsap.to(p, { scale: 0, opacity: 0, duration: 0.25, onComplete: () => p.parentNode?.removeChild(p) });
    });
    particlesRef.current = [];
  }, []);

  const spawnParticles = useCallback(() => {
    if (!cardRef.current || !isHoveredRef.current) return;
    const { width, height } = cardRef.current.getBoundingClientRect();
    Array.from({ length: particleCount }).forEach((_, i) => {
      const id = window.setTimeout(() => {
        if (!isHoveredRef.current || !cardRef.current) return;
        const el = document.createElement("div");
        el.className = "particle";
        el.style.cssText = `left:${Math.random()*width}px;top:${Math.random()*height}px;background:rgba(${glowColor},1);box-shadow:0 0 6px rgba(${glowColor},0.6);`;
        cardRef.current.appendChild(el);
        particlesRef.current.push(el);
        gsap.fromTo(el, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(1.7)" });
        gsap.to(el, { x: (Math.random()-0.5)*80, y: (Math.random()-0.5)*80, rotation: Math.random()*360, duration: 2+Math.random()*2, ease: "none", repeat: -1, yoyo: true });
        gsap.to(el, { opacity: 0.25, duration: 1.5, ease: "power2.inOut", repeat: -1, yoyo: true });
      }, i * 80);
      timeoutsRef.current.push(id);
    });
  }, [glowColor, particleCount]);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const onEnter = () => {
      isHoveredRef.current = true;
      spawnParticles();
      if (enableTilt) gsap.to(el, { rotateX: 4, rotateY: 4, duration: 0.3, ease: "power2.out", transformPerspective: 1000 });
    };
    const onLeave = () => {
      isHoveredRef.current = false;
      clearParticles();
      if (enableTilt) gsap.to(el, { rotateX: 0, rotateY: 0, duration: 0.3, ease: "power2.out" });
      if (enableMagnetism) gsap.to(el, { x: 0, y: 0, duration: 0.3, ease: "power2.out" });
    };
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      const cx = rect.width / 2, cy = rect.height / 2;
      if (enableTilt) gsap.to(el, { rotateX: ((y-cy)/cy)*-8, rotateY: ((x-cx)/cx)*8, duration: 0.1, ease: "power2.out", transformPerspective: 1000 });
      if (enableMagnetism) { magnetRef.current = gsap.to(el, { x: (x-cx)*0.04, y: (y-cy)*0.04, duration: 0.3, ease: "power2.out" }); }
    };
    const onClickFn = (e: MouseEvent) => {
      if (!clickEffect) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      const d = Math.max(Math.hypot(x,y), Math.hypot(x-rect.width,y), Math.hypot(x,y-rect.height), Math.hypot(x-rect.width,y-rect.height));
      const rip = document.createElement("div");
      rip.style.cssText = `position:absolute;width:${d*2}px;height:${d*2}px;border-radius:50%;background:radial-gradient(circle,rgba(${glowColor},0.35) 0%,rgba(${glowColor},0.15) 35%,transparent 70%);left:${x-d}px;top:${y-d}px;pointer-events:none;z-index:100;`;
      el.appendChild(rip);
      gsap.fromTo(rip, { scale: 0, opacity: 1 }, { scale: 1, opacity: 0, duration: 0.7, ease: "power2.out", onComplete: () => rip.remove() });
    };

    el.addEventListener("mouseenter", onEnter);
    el.addEventListener("mouseleave", onLeave);
    el.addEventListener("mousemove", onMove as EventListener);
    el.addEventListener("click", onClickFn as EventListener);
    return () => {
      el.removeEventListener("mouseenter", onEnter);
      el.removeEventListener("mouseleave", onLeave);
      el.removeEventListener("mousemove", onMove as EventListener);
      el.removeEventListener("click", onClickFn as EventListener);
      clearParticles();
    };
  }, [spawnParticles, clearParticles, enableTilt, enableMagnetism, clickEffect, glowColor]);

  return (
    <div ref={cardRef} className={className} style={{ ...style, position: "relative", overflow: "hidden" }} onClick={onClick}>
      {children}
    </div>
  );
}

export function GlobalSpotlight({ gridRef, glowColor = "128,128,128", spotlightRadius = 280, isDark = true }: { gridRef: React.RefObject<HTMLDivElement | null>; glowColor?: string; spotlightRadius?: number; isDark?: boolean }) {
  useEffect(() => {
    const spot = document.createElement("div");
    const [c0, c1, c2, blend] = isDark
      ? [`rgba(${glowColor},0.14)`, `rgba(${glowColor},0.07)`, `rgba(${glowColor},0.03)`, "screen"]
      : [`rgba(${glowColor},0.22)`, `rgba(${glowColor},0.12)`, `rgba(${glowColor},0.05)`, "multiply"];
    spot.style.cssText = `position:fixed;width:700px;height:700px;border-radius:50%;pointer-events:none;background:radial-gradient(circle,${c0} 0%,${c1} 20%,${c2} 40%,transparent 65%);z-index:200;opacity:0;transform:translate(-50%,-50%);mix-blend-mode:${blend};`;
    document.body.appendChild(spot);

    const proximity = spotlightRadius * 0.5;
    const fadeDistance = spotlightRadius * 0.8;

    const onMove = (e: MouseEvent) => {
      const grid = gridRef.current;
      if (!grid) return;
      const section = grid.closest(".bento-section");
      const rect = section?.getBoundingClientRect();
      const inside = rect && e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;

      const cards = grid.querySelectorAll<HTMLElement>(".magic-bento-card");
      if (!inside) {
        gsap.to(spot, { opacity: 0, duration: 0.3 });
        cards.forEach(c => c.style.setProperty("--glow-intensity", "0"));
        return;
      }

      let minDist = Infinity;
      cards.forEach(card => {
        const cr = card.getBoundingClientRect();
        const dist = Math.max(0, Math.hypot(e.clientX-(cr.left+cr.width/2), e.clientY-(cr.top+cr.height/2)) - Math.max(cr.width,cr.height)/2);
        minDist = Math.min(minDist, dist);
        const intensity = dist <= proximity ? 1 : dist <= fadeDistance ? (fadeDistance-dist)/(fadeDistance-proximity) : 0;
        const rx = ((e.clientX-cr.left)/cr.width)*100, ry = ((e.clientY-cr.top)/cr.height)*100;
        card.style.setProperty("--glow-x", `${rx}%`);
        card.style.setProperty("--glow-y", `${ry}%`);
        card.style.setProperty("--glow-intensity", intensity.toString());
        card.style.setProperty("--glow-radius", `${spotlightRadius}px`);
      });

      gsap.to(spot, { left: e.clientX, top: e.clientY, duration: 0.1 });
      const targetOpacity = minDist <= proximity ? 0.75 : minDist <= fadeDistance ? ((fadeDistance-minDist)/(fadeDistance-proximity))*0.75 : 0;
      gsap.to(spot, { opacity: targetOpacity, duration: targetOpacity > 0 ? 0.2 : 0.4 });
    };
    const onLeave = () => {
      gsap.to(spot, { opacity: 0, duration: 0.3 });
      gridRef.current?.querySelectorAll<HTMLElement>(".magic-bento-card").forEach(c => c.style.setProperty("--glow-intensity","0"));
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      spot.parentNode?.removeChild(spot);
    };
  }, [gridRef, glowColor, spotlightRadius, isDark]);

  return null;
}
