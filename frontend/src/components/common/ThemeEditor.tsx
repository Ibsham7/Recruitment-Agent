import { useRef } from "react";
import { RotateCcw, X, Moon, Sun } from "lucide-react";
import { Theme } from "../../lib/types";
import { PRESETS, hexToRgba, hexToRgb } from "../../lib/theme";

function TokenRow({ label, value, onChange, txtMuted, txtGhost, cardBg, isDark }: {
  label: string; value: string; onChange: (v: string) => void;
  txtMuted: string; txtGhost: string; cardBg: string; isDark: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] flex-1 min-w-0 truncate" style={{ color: txtMuted }}>{label}</span>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Color swatch — click to open picker */}
        <button onClick={() => inputRef.current?.click()} className="relative rounded-md flex-shrink-0" style={{ width: "22px", height: "22px", backgroundColor: value, border: `2px solid ${hexToRgba(cardBg, isDark ? 0.25 : 0.60)}`, boxShadow: "0 1px 4px rgba(0,0,0,0.20)", cursor: "pointer" }}>
          <input ref={inputRef} type="color" value={value} onChange={(e) => onChange(e.target.value)}
            style={{ position: "absolute", opacity: 0, width: 0, height: 0, pointerEvents: "none" }} />
        </button>
        {/* Hex input */}
        <input value={value} onChange={(e) => onChange(e.target.value)} maxLength={7}
          className="text-[10px] font-mono w-[70px] px-1.5 py-1 rounded-md focus:outline-none"
          style={{ background: hexToRgba(cardBg, isDark ? 0.10 : 0.40), border: `1px solid ${hexToRgba(cardBg, isDark ? 0.18 : 0.60)}`, color: txtGhost }} />
      </div>
    </div>
  );
}

export function ThemeEditor({ theme, onThemeChange, onClose }: { theme: Theme; onThemeChange: (t: Theme) => void; onClose: () => void }) {
  const set = (key: keyof Theme, value: string | boolean) => onThemeChange({ ...theme, [key]: value });

  const groups: { label: string; tokens: { key: keyof Theme; label: string }[] }[] = [
    { label: "Backgrounds", tokens: [
      { key: "bgPage",    label: "Page" },
      { key: "bgCard",    label: "Card surface" },
      { key: "bgSurface", label: "Sidebar / bars" },
    ]},
    { label: "Text", tokens: [
      { key: "txtPrimary",   label: "Primary (headings)" },
      { key: "txtBody",      label: "Body" },
      { key: "txtSecondary", label: "Secondary (labels)" },
      { key: "txtMuted",     label: "Muted (captions)" },
      { key: "txtGhost",     label: "Ghost (dividers)" },
    ]},
    { label: "Numbers", tokens: [
      { key: "numHero", label: "Hero display numbers" },
      { key: "numPos",  label: "High score  (≥ 80)" },
      { key: "numMid",  label: "Mid score   (60–79)" },
      { key: "numNeg",  label: "Low score   (< 60)" },
    ]},
    { label: "Actions & Accent", tokens: [
      { key: "accentPrimary", label: "Button / CTA background" },
      { key: "accentText",    label: "Text on button" },
      { key: "accentBadge",   label: "Active nav / badges" },
      { key: "progressFill",  label: "Progress bars" },
    ]},
  ];

  return (
    <div className="fixed inset-0 z-[100] flex justify-end" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="h-full w-[360px] flex flex-col overflow-hidden"
        style={{ background: hexToRgba(theme.bgSurface, theme.isDark ? 0.96 : 0.97), backdropFilter: "blur(40px)", WebkitBackdropFilter: "blur(40px)", borderLeft: `1px solid ${hexToRgba(theme.bgCard, theme.isDark ? 0.15 : 0.60)}`, boxShadow: theme.isDark ? "-20px 0 60px rgba(0,0,0,0.50)" : "-20px 0 60px rgba(0,0,0,0.12)" }}>

        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between flex-shrink-0" style={{ borderBottom: `1px solid ${hexToRgba(theme.bgCard, theme.isDark ? 0.12 : 0.50)}` }}>
          <div>
            <div className="text-sm font-semibold" style={{ color: theme.txtPrimary }}>Theme Editor</div>
            <div className="text-[11px]" style={{ color: theme.txtMuted }}>Changes apply live</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => onThemeChange(PRESETS.find(p => p.name === theme.name) ?? PRESETS[0])}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
              title="Reset to preset defaults"
              style={{ background: hexToRgba(theme.bgCard, theme.isDark ? 0.10 : 0.40), color: theme.txtMuted }}>
              <RotateCcw size={12} />
            </button>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
              style={{ background: hexToRgba(theme.bgCard, theme.isDark ? 0.10 : 0.40), color: theme.txtMuted }}>
              <X size={13} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Preset picker */}
          <div className="px-5 py-4" style={{ borderBottom: `1px solid ${hexToRgba(theme.bgCard, theme.isDark ? 0.10 : 0.45)}` }}>
            <div className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: theme.txtMuted }}>Presets</div>
            <div className="grid grid-cols-3 gap-2">
              {PRESETS.map((preset) => {
                const active = preset.name === theme.name;
                return (
                  <button key={preset.name} onClick={() => onThemeChange(preset)}
                    className="rounded-xl p-2.5 text-left transition-all cursor-pointer"
                    style={{ background: active ? hexToRgba(theme.accentBadge, 0.18) : hexToRgba(theme.bgCard, theme.isDark ? 0.08 : 0.40), border: active ? `1.5px solid ${hexToRgba(theme.accentBadge, 0.50)}` : `1px solid ${hexToRgba(theme.bgCard, theme.isDark ? 0.15 : 0.60)}` }}>
                    {/* Mini color strip */}
                    <div className="flex gap-0.5 mb-2 rounded overflow-hidden" style={{ height: "6px" }}>
                      {[preset.bgPage, preset.accentPrimary, preset.numHero, preset.numPos].map((c, i) => (
                        <div key={i} className="flex-1" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                    <div className="text-[10px] font-semibold leading-tight" style={{ color: active ? theme.accentBadge : theme.txtSecondary }}>{preset.name}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {preset.isDark ? <Moon size={8} style={{ color: theme.txtGhost }} /> : <Sun size={8} style={{ color: theme.txtGhost }} />}
                      <span className="text-[9px]" style={{ color: theme.txtGhost }}>{preset.isDark ? "Dark" : "Light"}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dark mode toggle */}
          <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${hexToRgba(theme.bgCard, theme.isDark ? 0.10 : 0.45)}` }}>
            <div className="flex items-center gap-2">
              {theme.isDark ? <Moon size={13} style={{ color: theme.accentBadge }} /> : <Sun size={13} style={{ color: theme.accentBadge }} />}
              <span className="text-xs font-medium" style={{ color: theme.txtPrimary }}>{theme.isDark ? "Dark mode" : "Light mode"}</span>
            </div>
            <button onClick={() => {
              const newDark = !theme.isDark;
              const preset = PRESETS.find(p => p.name === theme.name);
              if (newDark && preset?.darkVariant) { onThemeChange({ ...theme, isDark: true, ...preset.darkVariant }); }
              else if (!newDark && preset && preset.isDark === false) { onThemeChange({ ...preset, isDark: false }); }
              else { set("isDark", newDark); }
            }}
              className="w-10 h-6 rounded-full relative transition-all"
              style={{ background: theme.isDark ? hexToRgba(theme.accentBadge, 0.25) : hexToRgba(theme.bgCard, 0.40), border: `1px solid ${hexToRgba(theme.accentBadge, theme.isDark ? 0.40 : 0)}` }}>
              <span className="w-4 h-4 rounded-full absolute top-[3px] transition-all" style={{ left: theme.isDark ? "21px" : "3px", backgroundColor: theme.isDark ? theme.accentBadge : theme.txtGhost }} />
            </button>
          </div>

          {/* Tokens */}
          <div className="px-5 py-4 space-y-6 pb-20">
            {groups.map(g => (
              <div key={g.label}>
                <div className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: theme.txtMuted }}>{g.label}</div>
                <div className="space-y-2">
                  {g.tokens.map(t => (
                    <TokenRow key={t.key} label={t.label} value={theme[t.key] as string} onChange={(v) => set(t.key, v)} txtMuted={theme.txtMuted} txtGhost={theme.txtGhost} cardBg={theme.bgCard} isDark={theme.isDark} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
