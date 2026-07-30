import React from "react";
import { Theme } from "../../../lib/types";
import { getGlass } from "../../../lib/theme";
import { Mail, CheckCircle2, Clock, UserCheck } from "lucide-react";
import { ParticleCard } from "../../../components/common/MagicBento";

export interface InterviewsStatsProps {
  theme: Theme;
  glow: string;
  countShortlisted: number;
  countInvited: number;
  countInterviewing: number;
  countCompleted: number;
}

export function InterviewsStats({
  theme: t,
  glow,
  countShortlisted,
  countInvited,
  countInterviewing,
  countCompleted,
}: InterviewsStatsProps) {
  const G = getGlass(t);
  const stats = [
    { label: "Shortlisted (Ready)", value: countShortlisted, sub: "Pending email invitation", icon: <UserCheck size={16} /> },
    { label: "Invitations Sent", value: countInvited, sub: "Protected link issued", icon: <Mail size={16} /> },
    { label: "Assessment In Progress", value: countInterviewing, sub: "Candidate verified email", icon: <Clock size={16} /> },
    { label: "Completed / Review", value: countCompleted, sub: "Scored by AI evaluator", icon: <CheckCircle2 size={16} /> },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {stats.map((s) => (
        <ParticleCard
          key={s.label}
          className="magic-bento-card magic-bento-card--border-glow rounded-2xl p-5"
          style={{ "--glow-color": glow, ...G.cardWarm } as React.CSSProperties}
          glowColor={glow}
          particleCount={6}
          enableTilt={true}
          clickEffect={true}
          enableMagnetism={true}
        >
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: t.txtMuted }}>
            <span>{s.label}</span>
            <span style={{ color: t.accentPrimary }}>{s.icon}</span>
          </div>
          <div className="text-3xl font-semibold leading-none mb-1" style={{ fontFamily: "'Fraunces',serif", color: t.numHero }}>
            {s.value}
          </div>
          <div className="text-[11px]" style={{ color: t.txtGhost }}>
            {s.sub}
          </div>
        </ParticleCard>
      ))}
    </div>
  );
}
