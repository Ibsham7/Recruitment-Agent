import { Candidate, CandidateStage, Theme } from "../../../lib/types";
import { hexToRgba, getGlass } from "../../../lib/theme";
import { STAGE_CONFIG } from "../constants";
import { CandidateGridCard } from "./CandidateGridCard";

interface CandidateGridProps {
  activeCandidates: Candidate[];
  activeStage: CandidateStage;
  theme: Theme;
  G: ReturnType<typeof getGlass>;
}

export function CandidateGrid({ activeCandidates, activeStage, theme: t, G }: CandidateGridProps) {
  const stageConfig = STAGE_CONFIG[activeStage] || { label: 'selected', color: t.txtGhost };

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
      {activeCandidates.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full max-w-lg mx-auto text-center px-4" style={{ animation: 'fadeIn 0.5s ease-out' }}>
          <div className="w-20 h-20 sm:w-24 sm:h-24 mb-4 sm:mb-6 rounded-[1.5rem] sm:rounded-[2rem] flex items-center justify-center transition-transform hover:scale-105" 
               style={{ 
                 background: hexToRgba(stageConfig.color, 0.08), 
                 border: `1px solid ${hexToRgba(stageConfig.color, 0.2)}`,
                 boxShadow: `0 12px 32px ${hexToRgba(stageConfig.color, 0.1)}`
               }}>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full" 
                 style={{ 
                   backgroundColor: stageConfig.color, 
                   opacity: 0.8,
                   boxShadow: `0 0 20px ${stageConfig.color}`
                 }} 
            />
          </div>
          <h3 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-3" style={{ color: t.txtPrimary }}>No Candidates Yet</h3>
          <p className="text-sm sm:text-base leading-relaxed" style={{ color: t.txtSecondary }}>
            There are currently no candidates in the <strong style={{ color: stageConfig.color }}>{stageConfig.label}</strong> stage. 
            Candidates will appear here as they progress through your pipeline.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6">
          {activeCandidates.map((cand) => (
            <div key={cand.id} style={{ animation: 'fadeIn 0.4s ease-out' }}>
              <CandidateGridCard 
                candidate={cand} 
                theme={t} 
                G={G} 
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
