import { Theme } from "./types";

export function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length < 6) return "128,128,128";
  return `${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}`;
}

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  if (h.length < 6) return `rgba(128,128,128,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function getGlass(t: Theme) {
  const d = t.isDark;
  return {
    card: {
      background: hexToRgba(t.bgCard, d ? 0.14 : 0.65),
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      border: `1px solid ${hexToRgba(t.bgCard, d ? 0.22 : 0.88)}`,
      boxShadow: d ? "0 4px 28px rgba(0,0,0,0.35)" : "0 4px 24px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.9)",
    } as import("react").CSSProperties,
    cardWarm: {
      background: hexToRgba(t.bgCard, d ? 0.18 : 0.72),
      backdropFilter: "blur(24px)",
      WebkitBackdropFilter: "blur(24px)",
      border: `1px solid ${hexToRgba(t.bgCard, d ? 0.18 : 0.92)}`,
      boxShadow: d ? "0 6px 32px rgba(0,0,0,0.40)" : "0 6px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,1)",
    } as import("react").CSSProperties,
    bar: {
      background: hexToRgba(t.bgSurface, d ? 0.78 : 0.82),
      backdropFilter: "blur(28px)",
      WebkitBackdropFilter: "blur(28px)",
      borderBottom: `1px solid ${hexToRgba(t.bgCard, d ? 0.08 : 0.65)}`,
    } as import("react").CSSProperties,
    sidebar: {
      background: hexToRgba(t.bgSurface, d ? 0.82 : 0.84),
      backdropFilter: "blur(32px)",
      WebkitBackdropFilter: "blur(32px)",
      borderRight: `1px solid ${hexToRgba(t.bgCard, d ? 0.08 : 0.55)}`,
    } as import("react").CSSProperties,
  };
}

export function scoreColor(score: number, t: Theme) {
  if (score >= 80) return t.numPos;
  if (score >= 60) return t.numMid;
  return t.numNeg;
}

export const PRESETS: Theme[] = [
  {
    name: "Obsidian",
    isDark: true,
    bgPage: "#07070E",    bgCard: "#FFFFFF",    bgSurface: "#0D0D1A",
    txtPrimary: "#EEEEFF", txtBody: "#AAAAC8",   txtSecondary: "#7070A0",
    txtMuted: "#484870",   txtGhost: "#28284A",
    numHero: "#00FF7A",   numPos: "#00CC60",    numMid: "#FFB800",  numNeg: "#FF4455",
    accentPrimary: "#00CC60", accentText: "#000A08", accentBadge: "#00FF7A", progressFill: "#00CC60",
  },
  {
    name: "Ivory",
    isDark: false,
    bgPage: "#F8F5EF",    bgCard: "#FFFFFF",    bgSurface: "#EDE9E0",
    txtPrimary: "#08080F", txtBody: "#1E1E2A",   txtSecondary: "#44445A",
    txtMuted: "#747480",   txtGhost: "#A8A8B5",
    numHero: "#B01830",   numPos: "#1A7038",    numMid: "#8A5A18",  numNeg: "#B01830",
    accentPrimary: "#0A0A14", accentText: "#F8F5EF", accentBadge: "#B01830", progressFill: "#1A7038",
    darkVariant: {
      bgPage: "#0A0A0F", bgCard: "#FFFFFF", bgSurface: "#141418",
      txtPrimary: "#F0F0F8", txtBody: "#C8C8D8", txtSecondary: "#909098",
      txtMuted: "#606068", txtGhost: "#383840",
      numHero: "#E83050", numPos: "#38B058", numMid: "#C07828", numNeg: "#E83050",
      accentPrimary: "#F0F0F8", accentText: "#0A0A0F", accentBadge: "#E83050", progressFill: "#38B058",
    },
  },
  {
    name: "Plum Noir",
    isDark: true,
    bgPage: "#0C0612",    bgCard: "#C8A0FF",    bgSurface: "#140820",
    txtPrimary: "#F0E8FF", txtBody: "#B89AE0",   txtSecondary: "#806AAA",
    txtMuted: "#584878",   txtGhost: "#382858",
    numHero: "#CC78FF",   numPos: "#78CC78",    numMid: "#FFA838",  numNeg: "#FF5878",
    accentPrimary: "#9030D8", accentText: "#FFFFFF", accentBadge: "#CC78FF", progressFill: "#9030D8",
  },
  {
    name: "Copper Slate",
    isDark: true,
    bgPage: "#0C1018",    bgCard: "#FFFFFF",    bgSurface: "#121820",
    txtPrimary: "#D8E4F2", txtBody: "#9AAEC8",   txtSecondary: "#607890",
    txtMuted: "#384858",   txtGhost: "#243040",
    numHero: "#D06030",   numPos: "#38A058",    numMid: "#C09030",  numNeg: "#C04848",
    accentPrimary: "#D06030", accentText: "#FFFFFF", accentBadge: "#E07840", progressFill: "#38A058",
  },
  {
    name: "Paper & Ink",
    isDark: false,
    bgPage: "#f8f8f7",    bgCard: "#e8e6ce",    bgSurface: "#d8e0d1",
    txtPrimary: "#955d0f", txtBody: "#121221",   txtSecondary: "#44445A",
    txtMuted: "#747480",   txtGhost: "#ca974e",
    numHero: "#120e48",   numPos: "#18582E",    numMid: "#784410",  numNeg: "#880A22",
    accentPrimary: "#0679e5", accentText: "#FAF8F2", accentBadge: "#880A22", progressFill: "#18582E",
    darkVariant: {
      bgPage: "#17140d", bgCard: "#FFFFFF", bgSurface: "#201c13",
      txtPrimary: "#e8a030", txtBody: "#f0ece3", txtSecondary: "#c4baa8",
      txtMuted: "#807260",   txtGhost: "#524338",
      numHero: "#7080e8", numPos: "#50b870", numMid: "#d89040", numNeg: "#e85068",
      accentPrimary: "#3a9aff", accentText: "#FAF8F2", accentBadge: "#e85068", progressFill: "#50b870",
    },
  },
  {
    name: "Cobalt Night",
    isDark: true,
    bgPage: "#02080F",    bgCard: "#FFFFFF",    bgSurface: "#04101C",
    txtPrimary: "#A8CFF0", txtBody: "#6090B8",   txtSecondary: "#386888",
    txtMuted: "#204860",   txtGhost: "#103040",
    numHero: "#00B8FF",   numPos: "#00D870",    numMid: "#FFB020",  numNeg: "#FF4060",
    accentPrimary: "#0080CC", accentText: "#FFFFFF", accentBadge: "#00B8FF", progressFill: "#00D870",
  },
];
