import { Theme } from "../../../lib/types";
import { hexToRgba } from "../../../lib/theme";

export const logoLightImg = "/Screenshot_2026-07-10_121453-removebg-preview.png";
export const logoDarkImg = "/Screenshot_2026-07-10_121508-removebg-preview.png";

export interface BrandingHeaderProps {
  theme: Theme;
  mode: "login" | "signup";
  onSwitch: (m: "login" | "signup") => void;
  onBack?: () => void;
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
      {/* Logo */}
      <div className="flex justify-center mb-6 sm:mb-8">
        <button
          type="button"
          onClick={onBack}
          className="bg-transparent border-0 p-0 cursor-pointer transition-transform hover:scale-105 active:scale-95 focus:outline-none"
          title="HireAgent"
        >
          <img
            src={t.isDark ? logoDarkImg : logoLightImg}
            alt="hireagent"
            style={{ width: "160px", height: "52px", objectFit: "contain" }}
          />
        </button>
      </div>

      {/* Mode toggle */}
      <div
        className="flex w-full mb-6 rounded-2xl p-1 shadow-sm"
        style={{
          background: hexToRgba(t.bgCard, t.isDark ? 0.16 : 0.55),
          border: `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.24 : 0.75)}`,
        }}
      >
        {(["login", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setError?.("");
              setSuccess?.("");
              onSwitch(m);
            }}
            className="flex-1 min-h-[38px] py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none"
            style={{
              background:
                mode === m
                  ? `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.78)})`
                  : "transparent",
              color: mode === m ? t.accentText : t.txtMuted,
              boxShadow: mode === m ? `0 2px 10px ${hexToRgba(t.accentPrimary, 0.30)}` : "none",
            }}
          >
            {m === "login" ? "Sign In" : "Create Account"}
          </button>
        ))}
      </div>
    </>
  );
}

