import { useNavigate } from "react-router";
import { Theme } from "../lib/types";
import { hexToRgb, hexToRgba, getGlass } from "../lib/theme";
import { FuzzyText } from "../components/common/FuzzyText";

export default function NotFoundPage({ theme: t }: { theme: Theme }) {
  const navigate = useNavigate();
  const G = getGlass(t);
  
  const onBack = () => navigate("/dashboard");

  return (
    <div className="flex flex-col items-center justify-center h-full relative select-none">
      {/* Ambient glow behind the number */}
      <div style={{ position: "absolute", width: "600px", height: "600px", borderRadius: "50%", background: `radial-gradient(circle, ${hexToRgba(t.numHero, t.isDark ? 0.12 : 0.08)} 0%, transparent 65%)`, pointerEvents: "none" }} />

      <div className="flex flex-col items-center gap-6 relative z-10">
        {/* Fuzzy 404 */}
        <FuzzyText
          fontSize="clamp(7rem, 18vw, 14rem)"
          fontWeight={700}
          fontFamily="'Fraunces', serif"
          color={t.numHero}
          baseIntensity={0.12}
          hoverIntensity={0.55}
          fuzzRange={28}
          transitionDuration={10}
          glitchMode={true}
          glitchInterval={2800}
          glitchDuration={180}
          clickEffect={true}
          enableHover={true}
          direction="horizontal"
        >
          404
        </FuzzyText>

        {/* Subtitle card */}
        <div className="rounded-2xl px-8 py-6 text-center max-w-sm" style={G.cardWarm}>
          <div className="text-base font-semibold mb-1.5" style={{ color: t.txtPrimary }}>Page not found</div>
          <p className="text-sm leading-relaxed mb-5" style={{ color: t.txtSecondary }}>
            This section isn{"'"}t built yet. Head back to your campaigns and keep hiring.
          </p>
          <button onClick={onBack}
            className="w-full py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.72)})`, color: t.accentText, boxShadow: `0 4px 20px ${hexToRgba(t.accentPrimary, 0.35)}` }}>
            Back to Campaigns
          </button>
        </div>

        {/* Error code badge */}
        <div className="flex items-center gap-2 text-[11px]" style={{ fontFamily: "'DM Mono', monospace", color: t.txtGhost }}>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: t.numNeg, display: "inline-block", boxShadow: `0 0 6px ${hexToRgba(t.numNeg, 0.7)}` }} />
          ERR_ROUTE_NOT_FOUND · hireagent/v1
        </div>
      </div>
    </div>
  );
}
