import { ArrowLeft, Sparkles } from "lucide-react";
import { Theme } from "../../../lib/types";
import { hexToRgba } from "../../../lib/theme";

export const logoLightImg = "/Screenshot_2026-07-10_121453-removebg-preview.png";
export const logoDarkImg = "/Screenshot_2026-07-10_121508-removebg-preview.png";

export interface AuthNavbarProps {
  theme: Theme;
  mode: "login" | "signup";
  onSwitch: (m: "login" | "signup") => void;
  onBack: () => void;
  setError?: (err: string) => void;
  setSuccess?: (msg: string) => void;
}

export function AuthNavbar({
  theme: t,
  mode,
  onSwitch,
  onBack,
  setError,
  setSuccess,
}: AuthNavbarProps) {
  const isLogin = mode === "login";

  const handleModeSwitch = () => {
    setError?.("");
    setSuccess?.("");
    onSwitch(isLogin ? "signup" : "login");
  };

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 h-16 md:h-[68px] transition-all duration-200"
      style={{
        background: hexToRgba(t.bgPage, t.isDark ? 0.85 : 0.90),
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: `1px solid ${hexToRgba(t.txtBody, t.isDark ? 0.08 : 0.06)}`,
      }}
    >
      <div className="max-w-7xl mx-auto w-full h-full px-3.5 sm:px-6 md:px-8 flex items-center justify-between gap-2">
        {/* Left: Back button & Logo */}
        <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
          <button
            type="button"
            onClick={onBack}
            className="min-h-[42px] min-w-[42px] sm:px-3.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-1.5 cursor-pointer select-none"
            style={{
              background: hexToRgba(t.bgCard, t.isDark ? 0.22 : 0.60),
              border: `1px solid ${hexToRgba(t.txtBody, t.isDark ? 0.12 : 0.10)}`,
              color: t.txtBody,
            }}
            aria-label="Back to home"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Back to Home</span>
            <span className="sm:hidden text-xs">Home</span>
          </button>

          <button
            type="button"
            onClick={onBack}
            className="flex items-center min-h-[42px] cursor-pointer bg-transparent border-0 p-0 text-left focus:outline-none rounded-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
            aria-label="AgenticHR Home"
          >
            <img
              src={t.isDark ? logoDarkImg : logoLightImg}
              alt="AgenticHR logo"
              width={120}
              height={32}
              decoding="async"
              className="h-6 sm:h-7 md:h-8 w-auto max-w-[110px] sm:max-w-[140px] object-contain object-left select-none"
            />
          </button>
        </div>

        {/* Right: Quick Switch Mode Pill / Button */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="hidden sm:flex items-center text-xs font-medium" style={{ color: t.txtMuted }}>
            {isLogin ? "Don't have an account?" : "Already have an account?"}
          </div>

          <button
            type="button"
            onClick={handleModeSwitch}
            className="min-h-[42px] min-w-[42px] px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-1.5 shrink-0 cursor-pointer select-none"
            style={{
              background: isLogin
                ? `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.80)})`
                : hexToRgba(t.bgCard, t.isDark ? 0.28 : 0.70),
              color: isLogin ? t.accentText : t.txtPrimary,
              border: isLogin ? "none" : `1px solid ${hexToRgba(t.txtBody, t.isDark ? 0.15 : 0.12)}`,
              boxShadow: isLogin ? `0 2px 10px ${hexToRgba(t.accentPrimary, 0.32)}` : "none",
            }}
          >
            {isLogin ? (
              <>
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-nowrap">Sign Up</span>
              </>
            ) : (
              <span className="whitespace-nowrap">Sign In</span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
