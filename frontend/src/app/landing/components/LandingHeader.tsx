import { Theme } from "../../../lib/types";
import { hexToRgba } from "../../../lib/theme";
import { PillNav } from "../../../components/common/PillNav";

interface LandingHeaderProps {
  theme: Theme;
  onEnter: () => void;
  logoLightImg: string;
  logoDarkImg: string;
}

export function LandingHeader({ theme: t, onEnter, logoLightImg, logoDarkImg }: LandingHeaderProps) {
  return (
    <header 
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        height: "72px",
        background: hexToRgba(t.bgPage, t.isDark ? 0.75 : 0.85),
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: `1px solid ${hexToRgba(t.txtBody, t.isDark ? 0.08 : 0.06)}`,
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        padding: "0 2rem",
        gap: "1rem"
      }}
    >
      <div className="flex items-center">
        <img src={t.isDark ? logoDarkImg : logoLightImg} alt="hireagent logo" width={148} height={48} decoding="async" fetchpriority="high" className="cursor-target max-h-9 w-auto object-contain object-left" />
      </div>

      <PillNav
        containerStyle={{ position: "relative", top: "unset" }}
        baseColor={t.isDark ? hexToRgba(t.bgSurface, 0.88) : hexToRgba(t.txtBody, 0.88)}
        pillColor={t.isDark ? hexToRgba(t.bgCard, 0.16) : hexToRgba(t.bgCard, 0.92)}
        pillTextColor={t.isDark ? t.txtBody : t.txtBody}
        hoveredPillTextColor={t.isDark ? t.bgPage : t.bgPage}
        items={[
          { label: "Features", onClick: () => document.getElementById("ha-features")?.scrollIntoView({ behavior: "smooth" }) },
          { label: "How it works", onClick: () => document.getElementById("ha-process")?.scrollIntoView({ behavior: "smooth" }) },
          { label: "FAQ", onClick: () => document.getElementById("ha-faq")?.scrollIntoView({ behavior: "smooth" }) },
          { label: "Sign in", onClick: onEnter },
        ]}
      />

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={onEnter}
          className="cursor-target px-4 sm:px-5 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.78)})`, color: t.accentText, boxShadow: `0 2px 12px ${hexToRgba(t.accentPrimary, 0.35)}` }}>
          Get started →
        </button>
      </div>
    </header>
  );
}
