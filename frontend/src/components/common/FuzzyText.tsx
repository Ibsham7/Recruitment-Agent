import { useEffect, useRef } from "react";

export interface FuzzyTextProps {
  children: React.ReactNode;
  fontSize?: number | string;
  fontWeight?: string | number;
  fontFamily?: string;
  color?: string;
  enableHover?: boolean;
  baseIntensity?: number;
  hoverIntensity?: number;
  fuzzRange?: number;
  fps?: number;
  direction?: "horizontal" | "vertical" | "both";
  transitionDuration?: number;
  clickEffect?: boolean;
  glitchMode?: boolean;
  glitchInterval?: number;
  glitchDuration?: number;
  gradient?: string[] | null;
  letterSpacing?: number;
  className?: string;
}

export function FuzzyText({
  children, fontSize = "clamp(2rem, 10vw, 10rem)", fontWeight = 900,
  fontFamily = "inherit", color = "#fff", enableHover = true,
  baseIntensity = 0.18, hoverIntensity = 0.5, fuzzRange = 30, fps = 60,
  direction = "horizontal", transitionDuration = 0, clickEffect = false,
  glitchMode = false, glitchInterval = 2000, glitchDuration = 200,
  gradient = null, letterSpacing = 0, className = "",
}: FuzzyTextProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let animId: number, cancelled = false;
    let glitchTid: ReturnType<typeof setTimeout>, glitchEndTid: ReturnType<typeof setTimeout>, clickTid: ReturnType<typeof setTimeout>;
    const canvas = canvasRef.current;
    if (!canvas) return;

    (async () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const computedFamily = fontFamily === "inherit" ? window.getComputedStyle(canvas).fontFamily || "sans-serif" : fontFamily;
      const fontSizeStr = typeof fontSize === "number" ? `${fontSize}px` : fontSize;
      const fontString = `${fontWeight} ${fontSizeStr} ${computedFamily}`;
      try { await document.fonts.load(fontString); } catch { await document.fonts.ready; }
      if (cancelled) return;

      let numericSize: number;
      if (typeof fontSize === "number") { numericSize = fontSize; }
      else {
        const tmp = document.createElement("span");
        tmp.style.fontSize = fontSize; document.body.appendChild(tmp);
        numericSize = parseFloat(window.getComputedStyle(tmp).fontSize);
        document.body.removeChild(tmp);
      }

      const text = (Array.isArray(children) ? children : [children]).join("");
      const off = document.createElement("canvas");
      const offCtx = off.getContext("2d")!;
      offCtx.font = `${fontWeight} ${fontSizeStr} ${computedFamily}`;
      offCtx.textBaseline = "alphabetic";

      let totalW = letterSpacing !== 0 ? [...text].reduce((a, c) => a + offCtx.measureText(c).width + letterSpacing, 0) - letterSpacing : offCtx.measureText(text).width;
      const m = offCtx.measureText(text);
      const aL = m.actualBoundingBoxLeft ?? 0;
      const aR = letterSpacing !== 0 ? totalW : (m.actualBoundingBoxRight ?? m.width);
      const asc = m.actualBoundingBoxAscent ?? numericSize;
      const desc = m.actualBoundingBoxDescent ?? numericSize * 0.2;
      const tW = Math.ceil(letterSpacing !== 0 ? totalW : aL + aR);
      const tH = Math.ceil(asc + desc);
      const xBuf = 10;
      off.width = tW + xBuf; off.height = tH;
      const xOff = xBuf / 2;
      offCtx.font = `${fontWeight} ${fontSizeStr} ${computedFamily}`;
      offCtx.textBaseline = "alphabetic";
      if (gradient && gradient.length >= 2) {
        const g = offCtx.createLinearGradient(0, 0, off.width, 0);
        gradient.forEach((c, i) => g.addColorStop(i / (gradient.length - 1), c));
        offCtx.fillStyle = g;
      } else { offCtx.fillStyle = color; }
      if (letterSpacing !== 0) { let xp = xOff; for (const c of text) { offCtx.fillText(c, xp, asc); xp += offCtx.measureText(c).width + letterSpacing; } }
      else { offCtx.fillText(text, xOff - aL, asc); }

      const hm = fuzzRange + 20;
      canvas.width = off.width + hm * 2; canvas.height = tH;
      ctx.translate(hm, 0);

      let hovering = false, clicking = false, glitching = false;
      let cur = baseIntensity, tgt = baseIntensity, last = 0;
      const fd = 1000 / fps;

      const startGlitch = () => { if (!glitchMode || cancelled) return; glitchTid = setTimeout(() => { if (cancelled) return; glitching = true; glitchEndTid = setTimeout(() => { glitching = false; startGlitch(); }, glitchDuration); }, glitchInterval); };
      if (glitchMode) startGlitch();

      const run = (ts: number) => {
        if (cancelled) return;
        if (ts - last < fd) { animId = requestAnimationFrame(run); return; }
        last = ts;
        ctx.clearRect(-fuzzRange-20, -fuzzRange-10, off.width+2*(fuzzRange+20), tH+2*(fuzzRange+10));
        tgt = clicking || glitching ? 1 : hovering ? hoverIntensity : baseIntensity;
        if (transitionDuration > 0) { const s = 1/(transitionDuration/fd); cur = cur<tgt ? Math.min(cur+s,tgt) : Math.max(cur-s,tgt); } else { cur = tgt; }
        if (direction === "horizontal") { for (let j=0;j<tH;j++) { const dx=Math.floor(cur*(Math.random()-0.5)*fuzzRange); ctx.drawImage(off,0,j,off.width,1,dx,j,off.width,1); } }
        else if (direction === "vertical") { for (let i=0;i<off.width;i++) { const dy=Math.floor(cur*(Math.random()-0.5)*fuzzRange); ctx.drawImage(off,i,0,1,tH,i,dy,1,tH); } }
        else { for (let j=0;j<tH;j++) { const dx=Math.floor(cur*(Math.random()-0.5)*fuzzRange); ctx.drawImage(off,0,j,off.width,1,dx,j,off.width,1); } }
        animId = requestAnimationFrame(run);
      };
      animId = requestAnimationFrame(run);

      const inArea = (x: number, y: number) => x >= hm+xOff && x <= hm+xOff+tW && y >= 0 && y <= tH;
      const onMove = (e: MouseEvent) => { if (!enableHover) return; const r=canvas.getBoundingClientRect(); hovering=inArea(e.clientX-r.left,e.clientY-r.top); };
      const onLeave = () => { hovering = false; };
      const onClick = () => { if (!clickEffect) return; clicking=true; clearTimeout(clickTid); clickTid=setTimeout(()=>{clicking=false;},150); };
      if (enableHover) { canvas.addEventListener("mousemove",onMove); canvas.addEventListener("mouseleave",onLeave); }
      if (clickEffect) canvas.addEventListener("click",onClick);
      (canvas as any)._fuzzyCleanup = () => { cancelAnimationFrame(animId); clearTimeout(glitchTid); clearTimeout(glitchEndTid); clearTimeout(clickTid); canvas.removeEventListener("mousemove",onMove); canvas.removeEventListener("mouseleave",onLeave); canvas.removeEventListener("click",onClick); };
    })();

    return () => {
      cancelled = true; cancelAnimationFrame(animId);
      clearTimeout(glitchTid!); clearTimeout(glitchEndTid!); clearTimeout(clickTid!);
      (canvasRef.current as any)?._fuzzyCleanup?.();
    };
  }, [children, fontSize, fontWeight, fontFamily, color, enableHover, baseIntensity, hoverIntensity, fuzzRange, fps, direction, transitionDuration, clickEffect, glitchMode, glitchInterval, glitchDuration, gradient, letterSpacing]);

  return <canvas ref={canvasRef} className={className} />;
}
