import { useEffect, useState, useRef, useCallback } from "react";
import { Theme } from "../../../lib/types";
import { hexToRgba } from "../../../lib/theme";

interface LandingScrollbarProps {
  theme: Theme;
}

export function LandingScrollbar({ theme: t }: LandingScrollbarProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const thumbHeightRef = useRef<number>(60);
  const scrollProgressRef = useRef<number>(0);
  const dragStartY = useRef(0);
  const dragStartScroll = useRef(0);
  const rafId = useRef<number | null>(null);

  // Check if device is desktop / laptop with fine pointer and hover support via matchMedia
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(hover: hover) and (pointer: fine)");
    const checkDevice = () => {
      setIsDesktop(mql.matches && window.innerWidth >= 1024);
    };

    checkDevice();
    mql.addEventListener("change", checkDevice);
    window.addEventListener("resize", checkDevice, { passive: true });
    return () => {
      mql.removeEventListener("change", checkDevice);
      window.removeEventListener("resize", checkDevice);
    };
  }, []);

  // Update scroll metrics directly in DOM to eliminate React state updates on scroll frames
  const updateScrollMetrics = useCallback(() => {
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
    }

    rafId.current = requestAnimationFrame(() => {
      const docHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight
      );
      const winHeight = window.innerHeight;
      const maxScroll = Math.max(1, docHeight - winHeight);
      const currentScroll = window.scrollY || document.documentElement.scrollTop || 0;

      const progress = Math.min(1, Math.max(0, currentScroll / maxScroll));
      scrollProgressRef.current = progress;

      if (trackRef.current && thumbRef.current) {
        const trackHeight = trackRef.current.clientHeight;
        const calculatedThumbHeight = Math.max(
          40,
          Math.min(trackHeight * 0.8, (winHeight / docHeight) * trackHeight)
        );
        thumbHeightRef.current = calculatedThumbHeight;
        const availableTrack = Math.max(0, trackHeight - calculatedThumbHeight);
        const thumbTop = progress * availableTrack;

        thumbRef.current.style.height = `${calculatedThumbHeight}px`;
        thumbRef.current.style.transform = `translateY(${thumbTop}px)`;
      }
    });
  }, []);

  useEffect(() => {
    if (!isDesktop) return;

    updateScrollMetrics();
    window.addEventListener("scroll", updateScrollMetrics, { passive: true });
    window.addEventListener("resize", updateScrollMetrics, { passive: true });

    const resizeObserver = new ResizeObserver(() => {
      updateScrollMetrics();
    });

    if (document.body) {
      resizeObserver.observe(document.body);
    }

    return () => {
      window.removeEventListener("scroll", updateScrollMetrics);
      window.removeEventListener("resize", updateScrollMetrics);
      resizeObserver.disconnect();
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, [isDesktop, updateScrollMetrics]);

  // Handle Dragging
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();

    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartScroll.current = window.scrollY || document.documentElement.scrollTop || 0;

    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (!trackRef.current) return;

      const currentThumbHeight = thumbHeightRef.current;
      const trackHeight = trackRef.current.clientHeight;
      const availableTrack = trackHeight - currentThumbHeight;
      if (availableTrack <= 0) return;

      const docHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight
      );
      const winHeight = window.innerHeight;
      const maxScroll = Math.max(0, docHeight - winHeight);

      const deltaY = moveEvent.clientY - dragStartY.current;
      const scrollDelta = (deltaY / availableTrack) * maxScroll;

      window.scrollTo({
        top: Math.max(0, Math.min(maxScroll, dragStartScroll.current + scrollDelta)),
        behavior: "instant" as ScrollBehavior,
      });
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      try {
        target.releasePointerCapture(upEvent.pointerId);
      } catch {
        // Pointer capture release fallback
      }
      setIsDragging(false);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  };

  // Handle clicking directly on track to jump
  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current) return;

    const currentThumbHeight = thumbHeightRef.current;
    const trackRect = trackRef.current.getBoundingClientRect();
    const clickY = e.clientY - trackRect.top;
    const trackHeight = trackRect.height;
    const availableTrack = trackHeight - currentThumbHeight;

    if (availableTrack <= 0) return;

    const targetThumbTop = clickY - currentThumbHeight / 2;
    const targetProgress = Math.max(0, Math.min(1, targetThumbTop / availableTrack));

    const docHeight = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight
    );
    const winHeight = window.innerHeight;
    const maxScroll = Math.max(0, docHeight - winHeight);

    window.scrollTo({
      top: targetProgress * maxScroll,
      behavior: "smooth",
    });
  };

  if (!isDesktop) return null;

  const isVisible = isHovered || isDragging;

  return (
    <div
      className="fixed right-0 top-0 bottom-0 w-6 z-[9998] select-none hidden lg:block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        if (!isDragging) setIsHovered(false);
      }}
      aria-hidden="true"
    >
      {/* Scrollbar Track */}
      <div
        ref={trackRef}
        onClick={handleTrackClick}
        className={`absolute right-1.5 top-3 bottom-3 w-2 rounded-full cursor-pointer transition-all duration-300 ${
          isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
        }`}
        style={{
          backgroundColor: hexToRgba(t.txtBody, t.isDark ? 0.08 : 0.06),
          backdropFilter: "blur(8px)",
          border: `1px solid ${hexToRgba(t.txtBody, t.isDark ? 0.12 : 0.08)}`,
          boxShadow: isVisible ? "0 2px 8px rgba(0,0,0,0.2)" : "none",
        }}
      >
        {/* Scrollbar Thumb */}
        <div
          ref={thumbRef}
          onPointerDown={handlePointerDown}
          className={`absolute left-0 right-0 rounded-full transition-colors duration-150 cursor-grab active:cursor-grabbing ${
            isDragging ? "cursor-grabbing" : ""
          }`}
          style={{
            height: `${thumbHeightRef.current}px`,
            transform: "translateY(0px)",
            backgroundColor: isDragging
              ? t.accentPrimary
              : isHovered
              ? hexToRgba(t.accentPrimary, 0.85)
              : hexToRgba(t.accentPrimary, 0.6),
            boxShadow: isDragging
              ? `0 0 12px ${hexToRgba(t.accentPrimary, 0.7)}, 0 2px 6px rgba(0,0,0,0.4)`
              : `0 0 6px ${hexToRgba(t.accentPrimary, 0.35)}`,
            border: `1px solid ${hexToRgba("#ffffff", t.isDark ? 0.2 : 0.4)}`,
          }}
        />
      </div>
    </div>
  );
}

