import { useEffect, useRef } from "react";
import "./common.css";

export function ShapeGrid({ direction = "diagonal", speed = 1, borderColor = "#999", squareSize = 40, hoverFillColor = "#222", shape = "square", hoverTrailAmount = 0, className = "" }: { direction?: string; speed?: number; borderColor?: string; squareSize?: number; hoverFillColor?: string; shape?: string; hoverTrailAmount?: number; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const numSquaresX = useRef<number>(0);
  const numSquaresY = useRef<number>(0);
  const gridOffset = useRef({ x: 0, y: 0 });
  const hoveredSquare = useRef<{ x: number; y: number } | null>(null);
  const trailCells = useRef<{ x: number; y: number }[]>([]);
  const cellOpacities = useRef(new Map<string, number>());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const isHex = shape === "hexagon";
    const isTri = shape === "triangle";
    const hexHoriz = squareSize * 1.5;
    const hexVert = squareSize * Math.sqrt(3);

    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      numSquaresX.current = Math.ceil(canvas.width / squareSize) + 1;
      numSquaresY.current = Math.ceil(canvas.height / squareSize) + 1;
    };
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    const drawHex = (cx: number, cy: number, size: number) => { ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = (Math.PI / 3) * i; i === 0 ? ctx.moveTo(cx + size * Math.cos(a), cy + size * Math.sin(a)) : ctx.lineTo(cx + size * Math.cos(a), cy + size * Math.sin(a)); } ctx.closePath(); };
    const drawCircle = (cx: number, cy: number, size: number) => { ctx.beginPath(); ctx.arc(cx, cy, size / 2, 0, Math.PI * 2); ctx.closePath(); };
    const drawTriangle = (cx: number, cy: number, size: number, flip: boolean) => { ctx.beginPath(); if (flip) { ctx.moveTo(cx, cy + size / 2); ctx.lineTo(cx + size / 2, cy - size / 2); ctx.lineTo(cx - size / 2, cy - size / 2); } else { ctx.moveTo(cx, cy - size / 2); ctx.lineTo(cx + size / 2, cy + size / 2); ctx.lineTo(cx - size / 2, cy + size / 2); } ctx.closePath(); };

    const drawGrid = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (isHex) {
        const colShift = Math.floor(gridOffset.current.x / hexHoriz);
        const ox = ((gridOffset.current.x % hexHoriz) + hexHoriz) % hexHoriz;
        const oy = ((gridOffset.current.y % hexVert) + hexVert) % hexVert;
        const cols = Math.ceil(canvas.width / hexHoriz) + 3;
        const rows = Math.ceil(canvas.height / hexVert) + 3;
        for (let col = -2; col < cols; col++) for (let row = -2; row < rows; row++) {
          const cx = col * hexHoriz + ox, cy = row * hexVert + ((col + colShift) % 2 !== 0 ? hexVert / 2 : 0) + oy;
          const alpha = cellOpacities.current.get(`${col},${row}`);
          if (alpha) { ctx.globalAlpha = alpha; drawHex(cx, cy, squareSize); ctx.fillStyle = hoverFillColor; ctx.fill(); ctx.globalAlpha = 1; }
          drawHex(cx, cy, squareSize); ctx.strokeStyle = borderColor; ctx.stroke();
        }
      } else if (isTri) {
        const halfW = squareSize / 2;
        const colShift = Math.floor(gridOffset.current.x / halfW);
        const rowShift = Math.floor(gridOffset.current.y / squareSize);
        const ox = ((gridOffset.current.x % halfW) + halfW) % halfW;
        const oy = ((gridOffset.current.y % squareSize) + squareSize) % squareSize;
        const cols = Math.ceil(canvas.width / halfW) + 4, rows = Math.ceil(canvas.height / squareSize) + 4;
        for (let col = -2; col < cols; col++) for (let row = -2; row < rows; row++) {
          const cx = col * halfW + ox, cy = row * squareSize + squareSize / 2 + oy;
          const flip = ((col + colShift + row + rowShift) % 2 + 2) % 2 !== 0;
          const alpha = cellOpacities.current.get(`${col},${row}`);
          if (alpha) { ctx.globalAlpha = alpha; drawTriangle(cx, cy, squareSize, flip); ctx.fillStyle = hoverFillColor; ctx.fill(); ctx.globalAlpha = 1; }
          drawTriangle(cx, cy, squareSize, flip); ctx.strokeStyle = borderColor; ctx.stroke();
        }
      } else if (shape === "circle") {
        const ox = ((gridOffset.current.x % squareSize) + squareSize) % squareSize;
        const oy = ((gridOffset.current.y % squareSize) + squareSize) % squareSize;
        const cols = Math.ceil(canvas.width / squareSize) + 3, rows = Math.ceil(canvas.height / squareSize) + 3;
        for (let col = -2; col < cols; col++) for (let row = -2; row < rows; row++) {
          const cx = col * squareSize + squareSize / 2 + ox, cy = row * squareSize + squareSize / 2 + oy;
          const alpha = cellOpacities.current.get(`${col},${row}`);
          if (alpha) { ctx.globalAlpha = alpha; drawCircle(cx, cy, squareSize); ctx.fillStyle = hoverFillColor; ctx.fill(); ctx.globalAlpha = 1; }
          drawCircle(cx, cy, squareSize); ctx.strokeStyle = borderColor; ctx.stroke();
        }
      } else {
        const ox = ((gridOffset.current.x % squareSize) + squareSize) % squareSize;
        const oy = ((gridOffset.current.y % squareSize) + squareSize) % squareSize;
        const cols = Math.ceil(canvas.width / squareSize) + 3, rows = Math.ceil(canvas.height / squareSize) + 3;
        for (let col = -2; col < cols; col++) for (let row = -2; row < rows; row++) {
          const sx = col * squareSize + ox, sy = row * squareSize + oy;
          const alpha = cellOpacities.current.get(`${col},${row}`);
          if (alpha) { ctx.globalAlpha = alpha; ctx.fillStyle = hoverFillColor; ctx.fillRect(sx, sy, squareSize, squareSize); ctx.globalAlpha = 1; }
          ctx.strokeStyle = borderColor; ctx.strokeRect(sx, sy, squareSize, squareSize);
        }
      }
    };

    const updateCellOpacities = () => {
      const targets = new Map<string, number>();
      if (hoveredSquare.current) targets.set(`${hoveredSquare.current.x},${hoveredSquare.current.y}`, 1);
      if (hoverTrailAmount > 0) for (let i = 0; i < trailCells.current.length; i++) { const t = trailCells.current[i]; const k = `${t.x},${t.y}`; if (!targets.has(k)) targets.set(k, (trailCells.current.length - i) / (trailCells.current.length + 1)); }
      for (const [k] of targets) if (!cellOpacities.current.has(k)) cellOpacities.current.set(k, 0);
      for (const [k, op] of cellOpacities.current) { const tgt = targets.get(k) || 0; const next = op + (tgt - op) * 0.15; next < 0.005 ? cellOpacities.current.delete(k) : cellOpacities.current.set(k, next); }
    };

    const updateAnimation = () => {
      const es = Math.max(speed, 0.1);
      const wX = isHex ? hexHoriz * 2 : squareSize, wY = isHex ? hexVert : isTri ? squareSize * 2 : squareSize;
      if (direction === "right") gridOffset.current.x = (gridOffset.current.x - es + wX) % wX;
      else if (direction === "left") gridOffset.current.x = (gridOffset.current.x + es + wX) % wX;
      else if (direction === "up") gridOffset.current.y = (gridOffset.current.y + es + wY) % wY;
      else if (direction === "down") gridOffset.current.y = (gridOffset.current.y - es + wY) % wY;
      else { gridOffset.current.x = (gridOffset.current.x - es + wX) % wX; gridOffset.current.y = (gridOffset.current.y - es + wY) % wY; }
      updateCellOpacities(); drawGrid();
      requestRef.current = requestAnimationFrame(updateAnimation);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      let col: number, row: number;
      if (isHex) {
        const colShift = Math.floor(gridOffset.current.x / hexHoriz);
        const ox = ((gridOffset.current.x % hexHoriz) + hexHoriz) % hexHoriz, oy = ((gridOffset.current.y % hexVert) + hexVert) % hexVert;
        col = Math.round((mx - ox) / hexHoriz); row = Math.round((my - oy - ((col + colShift) % 2 !== 0 ? hexVert / 2 : 0)) / hexVert);
      } else if (isTri) {
        const halfW = squareSize / 2;
        const ox = ((gridOffset.current.x % halfW) + halfW) % halfW, oy = ((gridOffset.current.y % squareSize) + squareSize) % squareSize;
        col = Math.round((mx - ox) / halfW); row = Math.floor((my - oy) / squareSize);
      } else {
        const ox = ((gridOffset.current.x % squareSize) + squareSize) % squareSize, oy = ((gridOffset.current.y % squareSize) + squareSize) % squareSize;
        col = Math.floor((mx - ox) / squareSize); row = Math.floor((my - oy) / squareSize);
      }
      if (!hoveredSquare.current || hoveredSquare.current.x !== col || hoveredSquare.current.y !== row) {
        if (hoveredSquare.current && hoverTrailAmount > 0) { trailCells.current.unshift({ ...hoveredSquare.current }); if (trailCells.current.length > hoverTrailAmount) trailCells.current.length = hoverTrailAmount; }
        hoveredSquare.current = { x: col, y: row };
      }
    };
    const handleMouseLeave = () => {
      if (hoveredSquare.current && hoverTrailAmount > 0) { trailCells.current.unshift({ ...hoveredSquare.current }); if (trailCells.current.length > hoverTrailAmount) trailCells.current.length = hoverTrailAmount; }
      hoveredSquare.current = null;
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);
    requestRef.current = requestAnimationFrame(updateAnimation);
    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(requestRef.current);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [direction, speed, borderColor, hoverFillColor, squareSize, shape, hoverTrailAmount]);

  return <canvas ref={canvasRef} className={`shapegrid-canvas ${className}`} />;
}
