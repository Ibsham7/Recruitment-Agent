import { Theme } from "../../../lib/types";
import { hexToRgba } from "../../../lib/theme";
import { PillNav } from "../../../components/common/PillNav";

export const logoLightImg = "/Screenshot_2026-07-10_121453-removebg-preview.png";
export const logoDarkImg = "/Screenshot_2026-07-10_121508-removebg-preview.png";

export interface BrandingHeaderProps {
  theme: Theme;
  mode: "login" | "signup";
  onSwitch: (m: "login" | "signup") => void;
  onBack: () => void;
  setError?: (err: string) => void;
  setSuccess?: (msg: string) => void;
}

export function BrandingHeader({
  theme: t,
  mode,
  onSwitch,
  onBack,
  setError,
  setSuccess,
}: BrandingHeaderProps) {
  return (
    <>
      {/* PillNav — back to landing + mode switch */}
      <PillNav
        containerStyle={{ position: "absolute", top: "1.25rem", left: "50%", transform: "translateX(-50%)" }}
        baseColor={t.isDark ? hexToRgba(t.bgSurface, 0.90) : hexToRgba(t.txtBody, 0.90)}
        pillColor={t.isDark ? hexToRgba(t.bgCard, 0.18) : hexToRgba(t.bgCard, 0.92)}
        pillTextColor={t.txtBody}
        hoveredPillTextColor={t.bgPage}
        items={[
          { label: "← Home",   onClick: onBack },
          { label: "Sign In",  onClick: () => { setError?.(""); setSuccess?.(""); onSwitch("login"); },  active: mode === "login" },
          { label: "Sign Up",  onClick: () => { setError?.(""); setSuccess?.(""); onSwitch("signup"); }, active: mode === "signup" },
        ]}
      />

      {/* Logo */}
      <div className="flex justify-center mb-8">
        <img
          src={t.isDark ? logoDarkImg : logoLightImg}
          alt="hireagent"
          style={{ width: "160px", height: "52px", objectFit: "contain" }}
        />
      </div>

      {/* Mode toggle */}
      <div className="flex w-full mb-6 rounded-2xl p-1"
        style={{ background: hexToRgba(t.bgCard, t.isDark ? 0.14 : 0.50), border: `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.22 : 0.72)}` }}>
        {(["login", "signup"] as const).map((m) => (
          <button key={m} type="button"
            onClick={() => { setError?.(""); setSuccess?.(""); onSwitch(m); }}
            className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: mode === m
                ? `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.78)})`
                : "transparent",
              color: mode === m ? t.accentText : t.txtMuted,
              boxShadow: mode === m ? `0 2px 10px ${hexToRgba(t.accentPrimary, 0.30)}` : "none",
            }}>
            {m === "login" ? "Sign In" : "Create Account"}
          </button>
        ))}
      </div>
    </>
  );
}
