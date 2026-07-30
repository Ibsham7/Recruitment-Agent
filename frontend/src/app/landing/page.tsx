import { useRef } from "react";
import { useNavigate } from "react-router";
import { Theme } from "../../lib/types";
import { hexToRgba } from "../../lib/theme";
import TargetCursor from "../../components/common/TargetCursor";
import {
  LandingHeader,
  HeroSection,
  ProcessSection,
  StatsSection,
  FeaturesSection,
  FaqSection,
  CtaSection,
  LandingFooter
} from "./components";

const logoLightImg = "/logo-light.webp";
const logoDarkImg = "/logo-dark.webp";

export default function LandingPage({ theme: t }: { theme: Theme }) {
  const navigate = useNavigate();
  const onEnter = () => navigate("/auth");
  const processSectionRef = useRef<HTMLDivElement>(null);

  // Theme-derived ShapeGrid colors
  const gridBorder = hexToRgba(t.txtBody, t.isDark ? 0.07 : 0.09);
  const gridHover = hexToRgba(t.accentPrimary, t.isDark ? 0.35 : 0.18);

  return (
    <div className="relative w-full overflow-x-clip" style={{ background: t.bgPage, color: t.txtBody, minHeight: "100vh" }}>
      <TargetCursor
        cursorColor="#ffffff"
        cursorColorOnTarget={t.accentPrimary}
      />
      
      <LandingHeader theme={t} onEnter={onEnter} logoLightImg={logoLightImg} logoDarkImg={logoDarkImg} />
      
      <HeroSection theme={t} onEnter={onEnter} gridBorder={gridBorder} gridHover={gridHover} />
      
      <ProcessSection theme={t} onEnter={onEnter} processSectionRef={processSectionRef} />
      
      <StatsSection theme={t} />
      
      <FeaturesSection theme={t} />
      
      <FaqSection theme={t} onEnter={onEnter} />
      
      <CtaSection theme={t} onEnter={onEnter} gridBorder={gridBorder} gridHover={gridHover} />
      
      <LandingFooter theme={t} onEnter={onEnter} logoLightImg={logoLightImg} logoDarkImg={logoDarkImg} />
    </div>
  );
}
