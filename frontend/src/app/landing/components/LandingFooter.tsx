import { Theme } from "../../../lib/types";
import { hexToRgba } from "../../../lib/theme";

interface LandingFooterProps {
  theme: Theme;
  onEnter: () => void;
  logoLightImg: string;
  logoDarkImg: string;
}

export function LandingFooter({ theme: t, onEnter, logoLightImg, logoDarkImg }: LandingFooterProps) {
  return (
    <footer className="relative z-10 w-full pt-16 pb-12 px-8 border-t" style={{ borderColor: hexToRgba(t.txtBody, 0.08), background: hexToRgba(t.bgSurface, t.isDark ? 0.50 : 0.30) }}>
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
        <div className="md:col-span-1 flex flex-col items-start">
          <img src={t.isDark ? logoDarkImg : logoLightImg} alt="hireagent logo" width={130} height={40} className="mb-4 h-8 w-auto object-contain" />
          <p className="text-xs leading-relaxed mb-4" style={{ color: t.txtSecondary }}>
            Exponentially narrowing, ultra-cost-optimized AI screening & automated candidate interview engine.
          </p>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px]" style={{ background: hexToRgba(t.accentBadge, 0.12), color: t.accentBadge }}>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>All Systems Operational</span>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: t.txtPrimary, fontFamily: "'DM Mono',monospace" }}>Product</h4>
          <ul className="space-y-2.5 text-xs" style={{ color: t.txtSecondary }}>
            <li><button onClick={() => document.getElementById("ha-features")?.scrollIntoView({ behavior: "smooth" })} className="hover:underline">Features</button></li>
            <li><button onClick={() => document.getElementById("ha-process")?.scrollIntoView({ behavior: "smooth" })} className="hover:underline">How It Works</button></li>
            <li><button onClick={onEnter} className="hover:underline">Dashboard</button></li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: t.txtPrimary, fontFamily: "'DM Mono',monospace" }}>Architecture</h4>
          <ul className="space-y-2.5 text-xs" style={{ color: t.txtSecondary }}>
            <li><button onClick={() => document.getElementById("ha-faq")?.scrollIntoView({ behavior: "smooth" })} className="hover:underline">FAQ</button></li>
            <li><a href="#" className="hover:underline">Multi-Tier Screening</a></li>
            <li><a href="#" className="hover:underline">Vector Semantic Match</a></li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: t.txtPrimary, fontFamily: "'DM Mono',monospace" }}>Security & Data</h4>
          <ul className="space-y-2.5 text-xs" style={{ color: t.txtSecondary }}>
            <li><a href="/privacy" className="hover:underline">Candidate Data Privacy</a></li>
            <li><a href="/terms" className="hover:underline">Terms of Service</a></li>
            <li><a href="/privacy#sec-subprocessors" className="hover:underline">Data Sub-Processors</a></li>
          </ul>
        </div>
      </div>

      <div className="max-w-6xl mx-auto pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px]" style={{ borderColor: hexToRgba(t.txtBody, 0.06), color: t.txtGhost, fontFamily: "'DM Mono',monospace" }}>
        <span>© 2026 hireagent. All rights reserved.</span>
        <div className="flex items-center gap-4">
          <a href="/privacy" className="hover:underline">Privacy Policy</a>
          <span>•</span>
          <a href="/terms" className="hover:underline">Terms of Service</a>
        </div>
      </div>
    </footer>
  );
}
