import { Candidate, CandidateStage, Theme } from "../../../lib/types";
import { hexToRgba } from "../../../lib/theme";
import { STAGE_CONFIG } from "../constants";

interface PipelineStageTabsProps {
  stages: CandidateStage[];
  activeStage: CandidateStage;
  onSelectStage: (stage: CandidateStage) => void;
  candidates: Candidate[];
  theme: Theme;
}

export function PipelineStageTabs({ stages, activeStage, onSelectStage, candidates, theme: t }: PipelineStageTabsProps) {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-3 sm:py-5 flex-shrink-0 border-b relative z-0 overflow-x-auto" style={{ borderColor: hexToRgba(t.txtGhost, 0.1) }}>
      <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; } .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
      <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-max hide-scrollbar">
        {stages.map((stage) => {
          const config = STAGE_CONFIG[stage] || { label: stage, color: t.txtMuted };
          const count = candidates.filter((c) => c.stage === stage).length;
          const isActive = activeStage === stage;
          
          return (
            <button 
              key={stage}
              onClick={() => onSelectStage(stage)}
              className="min-h-[44px] flex items-center gap-2 sm:gap-3 px-3.5 sm:px-5 py-2 sm:py-3.5 rounded-2xl transition-all duration-300 group outline-none cursor-pointer active:scale-95"
              style={{ 
                background: isActive ? hexToRgba(config.color, 0.12) : hexToRgba(t.bgCard, t.isDark ? 0.05 : 0.4),
                border: `1px solid ${isActive ? hexToRgba(config.color, 0.5) : hexToRgba(t.txtGhost, 0.2)}`,
                boxShadow: isActive ? `0 8px 24px ${hexToRgba(config.color, 0.15)}, inset 0 1px 0 ${hexToRgba('#fff', 0.1)}` : '0 2px 8px rgba(0,0,0,0.05)',
                transform: isActive ? 'translateY(-2px)' : 'none'
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = hexToRgba(config.color, 0.05);
                  e.currentTarget.style.borderColor = hexToRgba(config.color, 0.3);
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = hexToRgba(t.bgCard, t.isDark ? 0.05 : 0.4);
                  e.currentTarget.style.borderColor = hexToRgba(t.txtGhost, 0.2);
                  e.currentTarget.style.transform = 'none';
                }
              }}
            >
              <div className="w-3 h-3 rounded-full transition-shadow duration-300" 
                   style={{ 
                     backgroundColor: config.color, 
                     boxShadow: isActive ? `0 0 12px ${config.color}` : 'none' 
                   }} 
              />
              <span className="text-sm font-semibold whitespace-nowrap transition-colors" 
                    style={{ color: isActive ? t.txtPrimary : t.txtSecondary }}>
                {config.label}
              </span>
              <div className="ml-1.5 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center justify-center transition-all" 
                   style={{ 
                     color: isActive ? config.color : t.txtGhost,
                     background: isActive ? hexToRgba(config.color, 0.15) : hexToRgba(t.txtGhost, 0.1)
                   }}>
                {count}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
