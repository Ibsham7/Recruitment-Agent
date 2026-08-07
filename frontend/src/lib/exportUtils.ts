import { Campaign, Candidate, RequirementItemBreakdown, ExperienceBreakdown, TrajectoryBreakdown, PenaltyBreakdownItem } from "./types";

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function generateCampaignMarkdownReport(campaign: Campaign, candidates: Candidate[]): string {
  const dateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  let md = `# Campaign Candidate Evaluation Report\n\n`;
  md += `## 📋 Campaign Overview\n`;
  md += `- **Campaign Title**: ${campaign.title || "Untitled Campaign"}\n`;
  md += `- **Campaign ID**: \`${campaign.id}\`\n`;
  md += `- **Status**: ${(campaign.status || "Active").toUpperCase()}\n`;
  md += `- **Location / Dept**: ${campaign.location || "Remote"} / ${campaign.department || "General"}\n`;
  md += `- **Total CVs Uploaded**: ${campaign.total || candidates.length}\n`;
  md += `- **Processed Candidates**: ${campaign.processed || candidates.length}\n`;
  md += `- **Shortlisted Candidates**: ${campaign.shortlisted || 0}\n`;
  if (campaign.totalCost !== undefined) {
    md += `- **Total API Cost**: $${campaign.totalCost.toFixed(4)}\n`;
  }
  md += `- **Report Generated On**: ${dateStr}\n\n`;

  if (campaign.jobDescription) {
    md += `### 📄 Job Description Summary\n`;
    md += `${campaign.jobDescription.trim()}\n\n`;
  }

  md += `---\n\n`;
  md += `## 📊 Candidates Summary Matrix\n\n`;
  md += `| # | Candidate Name | Email | Current Role | Experience | Stage | Decision | Fit Score |\n`;
  md += `|---|---|---|---|---|---|---|---|\n`;

  candidates.forEach((cand, idx) => {
    const score = cand.score ?? cand.fitScore ?? 0;
    const name = cand.name || "Unknown Candidate";
    const email = cand.email || "N/A";
    const role = cand.currentRole || cand.structuredProfile?.currentRole || "N/A";
    const exp = cand.experience || cand.structuredProfile?.experience || "N/A";
    const stage = cand.stage || cand.status || "screening";
    const decision = cand.recommendation || cand.decision || "pending";
    md += `| ${idx + 1} | **${name}** | ${email} | ${role} | ${exp} | \`${stage}\` | \`${decision}\` | **${score}/100** |\n`;
  });

  md += `\n---\n\n`;
  md += `## 🔍 Detailed Candidate Evaluations & XAI Breakdowns\n\n`;

  candidates.forEach((cand, idx) => {
    const evalData = cand.evaluation || {};
    const score = cand.score ?? cand.fitScore ?? 0;
    const breakdown = cand.scoreBreakdown || evalData.scoreBreakdown;
    const name = cand.name || `Candidate #${idx + 1}`;
    const email = cand.email || "N/A";
    const phone = cand.phone || "N/A";
    const role = cand.currentRole || cand.structuredProfile?.currentRole || "N/A";
    const exp = cand.experience || cand.structuredProfile?.experience || "N/A";
    const stage = cand.stage || cand.status || "screening";
    const decision = cand.recommendation || cand.decision || "pending";

    const techScore = cand.scores?.technical ?? evalData.technicalScore ?? "N/A";
    const commScore = cand.scores?.communication ?? evalData.communicationScore ?? "N/A";
    const cultScore = cand.scores?.culturalFit ?? evalData.culturalFitScore ?? "N/A";

    md += `### ${idx + 1}. ${name}\n\n`;
    md += `- **Candidate ID**: \`${cand.id}\`\n`;
    md += `- **Email**: ${email} | **Phone**: ${phone}\n`;
    md += `- **Current Role**: ${role} | **Experience**: ${exp}\n`;
    md += `- **Pipeline Stage**: \`${stage}\` | **Decision Status**: \`${decision}\`\n`;
    md += `- **Overall Fit Score**: **${score} / 100**\n`;
    md += `- **Category Scores**: Technical: **${techScore}** | Communication: **${commScore}** | Cultural Fit: **${cultScore}**\n`;
    if (cand.apiCost !== undefined) {
      md += `- **API Evaluation Cost**: $${cand.apiCost.toFixed(4)}\n`;
    }
    md += `\n`;

    // 1. Transparent XAI Score Breakdown
    md += `#### 🧮 Transparent XAI Score Breakdown & Attribution\n\n`;

    const reqSkillScore = breakdown?.required_skills_score ?? score;
    const expScore = breakdown?.experience_score ?? score;
    const niceScore = breakdown?.nice_to_have_score ?? score;
    const trajScore = breakdown?.trajectory_score ?? score;

    const weights = breakdown?.weights || { skills: 0.50, exp: 0.25, nice: 0.15, traj: 0.10 };
    const reqContrib = Number((reqSkillScore * weights.skills).toFixed(1));
    const expContrib = Number((expScore * weights.exp).toFixed(1));
    const niceContrib = Number((niceScore * weights.nice).toFixed(1));
    const trajContrib = Number((trajScore * weights.traj).toFixed(1));

    md += `- **Required Skills Score**: ${reqSkillScore}/100 (Weight: ${Math.round(weights.skills * 100)}% → Contribution: **${reqContrib}** pts)\n`;
    md += `- **Experience & Tenure Score**: ${expScore}/100 (Weight: ${Math.round(weights.exp * 100)}% → Contribution: **${expContrib}** pts)\n`;
    md += `- **Nice-to-Have Skills Score**: ${niceScore}/100 (Weight: ${Math.round(weights.nice * 100)}% → Contribution: **${niceContrib}** pts)\n`;
    md += `- **Growth Trajectory Score**: ${trajScore}/100 (Weight: ${Math.round(weights.traj * 100)}% → Contribution: **${trajContrib}** pts)\n`;
    md += `\n> **Formula Equation**: Fit Score (${score}) = ${reqContrib} (Skills) + ${expContrib} (Exp) + ${niceContrib} (Nice) + ${trajContrib} (Traj)\n\n`;

    // Must Have Requirements Breakdown
    let mustHaveItems: RequirementItemBreakdown[] = breakdown?.must_have_breakdown || [];
    if (mustHaveItems.length > 0) {
      md += `##### Must-Have Requirements Audit\n\n`;
      md += `| Requirement | Match Status | Points Earned | Max Points | Evidence / Deduction Reason |\n`;
      md += `|---|---|---|---|---|\n`;
      mustHaveItems.forEach((item) => {
        const matchBadge = item.match === "full" ? "✅ FULL" : item.match === "partial" ? "⚠️ PARTIAL" : "❌ NONE";
        const evidence = item.evidence || "N/A";
        const reason = item.deduction_reason ? ` (${item.deduction_reason})` : "";
        md += `| ${item.requirement} | ${matchBadge} | ${item.points_earned} | ${item.max_points} | ${evidence}${reason} |\n`;
      });
      md += `\n`;
    }

    // Nice to Have Breakdown
    let niceHaveItems: RequirementItemBreakdown[] = breakdown?.nice_to_have_breakdown || [];
    if (niceHaveItems.length > 0) {
      md += `##### Nice-to-Have Requirements Audit\n\n`;
      md += `| Requirement | Match Status | Points Earned | Max Points | Evidence |\n`;
      md += `|---|---|---|---|---|\n`;
      niceHaveItems.forEach((item) => {
        const matchBadge = item.match === "full" ? "✅ FULL" : item.match === "partial" ? "⚠️ PARTIAL" : "❌ NONE";
        md += `| ${item.requirement} | ${matchBadge} | ${item.points_earned} | ${item.max_points} | ${item.evidence || "N/A"} |\n`;
      });
      md += `\n`;
    }

    // Experience Breakdown
    const expBreakdown: ExperienceBreakdown | undefined = breakdown?.experience_breakdown;
    if (expBreakdown) {
      md += `##### Experience & Tenure Breakdown\n`;
      md += `- **Score**: ${expBreakdown.score}/100 (${expBreakdown.points_earned}/${expBreakdown.max_points} pts)\n`;
      if (expBreakdown.required_years !== undefined || expBreakdown.candidate_years !== undefined) {
        md += `- **Required vs Candidate Years**: Required ${expBreakdown.required_years || 0} yrs vs Candidate ${expBreakdown.candidate_years || 0} yrs\n`;
      }
      if (expBreakdown.assessment) {
        md += `- **Assessment**: ${expBreakdown.assessment}\n`;
      }
      md += `\n`;
    }

    // Trajectory Breakdown
    const trajBreakdown: TrajectoryBreakdown | undefined = breakdown?.trajectory_breakdown;
    if (trajBreakdown) {
      md += `##### Growth Trajectory Breakdown\n`;
      md += `- **Score**: ${trajBreakdown.score}/100 (${trajBreakdown.points_earned}/${trajBreakdown.max_points} pts)\n`;
      if (trajBreakdown.assessment) {
        md += `- **Assessment**: ${trajBreakdown.assessment}\n`;
      }
      if (trajBreakdown.sub_criteria && trajBreakdown.sub_criteria.length > 0) {
        md += `- **Sub-criteria**:\n`;
        trajBreakdown.sub_criteria.forEach((sc) => {
          md += `  - **${sc.criterion_name}**: ${sc.status.toUpperCase()} (${sc.points_earned}/${sc.max_points} pts) - ${sc.evidence}\n`;
        });
      }
      md += `\n`;
    }

    // Penalties Breakdown
    const penalties: PenaltyBreakdownItem[] = breakdown?.penalties_breakdown || [];
    if (penalties.length > 0) {
      md += `##### Penalties Deducted\n`;
      penalties.forEach((p) => {
        md += `- ⚠️ **${p.reason}** (${p.severity.toUpperCase()}): **-${p.points_deducted} pts**\n`;
      });
      md += `\n`;
    }

    // 2. Key Strengths (XAI)
    const strengths: string[] = cand.strengths || evalData.strengths || [];
    md += `#### 🟢 Key Strengths (XAI)\n`;
    if (strengths.length > 0) {
      strengths.forEach((s) => {
        md += `- ${s}\n`;
      });
    } else {
      md += `*No explicit strengths recorded.*\n`;
    }
    md += `\n`;

    // 3. Key Concerns & Risk Gaps (XAI)
    const concerns: string[] = cand.concerns || evalData.concerns || [];
    md += `#### 🔴 Concerns & Risk Gaps (XAI)\n`;
    if (concerns.length > 0) {
      concerns.forEach((c) => {
        md += `- ${c}\n`;
      });
    } else {
      md += `*No explicit concerns recorded.*\n`;
    }
    md += `\n`;

    // 4. AI Chain-of-Thought Reasoning
    const chainOfThought = cand.chainOfThought || evalData.chainOfThought;
    md += `#### 🧠 AI Chain-of-Thought Reasoning\n`;
    if (chainOfThought && chainOfThought !== "No reasoning provided.") {
      md += `\`\`\`text\n${chainOfThought.trim()}\n\`\`\`\n`;
    } else {
      md += `*No detailed step-by-step reasoning transcript available.*\n`;
    }
    md += `\n`;

    // 5. Executive Summary
    const summary = cand.summary || evalData.summary;
    md += `#### 📝 Executive Summary\n`;
    if (summary) {
      md += `${summary.trim()}\n`;
    } else {
      md += `*No executive summary provided.*\n`;
    }
    md += `\n`;

    // 6. Anti-Cheat & Verification
    const antiCheatFlags = cand.antiCheatFlags || evalData.antiCheatFlags || [];
    const antiCheatMetadata = cand.antiCheatMetadata || evalData.antiCheatMetadata;
    const aiLikelihood = cand.aiGeneratedLikelihoodScore ?? evalData.aiGeneratedLikelihoodScore;

    if ((antiCheatFlags && antiCheatFlags.length > 0) || antiCheatMetadata || aiLikelihood !== undefined) {
      md += `#### 🔒 Anti-Cheat & Verification Telemetry\n`;
      if (aiLikelihood !== undefined) {
        md += `- **AI-Generated Content Likelihood**: ${aiLikelihood}%\n`;
      }
      if (antiCheatMetadata) {
        md += `- **Blur Count**: ${antiCheatMetadata.blurCount || 0} | **Focus Duration**: ${antiCheatMetadata.focusDuration || 0}s\n`;
        md += `- **Paste Count**: ${antiCheatMetadata.pasteCount || 0} | **Paste Ratio**: ${Math.round((antiCheatMetadata.pasteRatio || 0) * 100)}%\n`;
      }
      if (antiCheatFlags && antiCheatFlags.length > 0) {
        md += `- **Flags Detected**:\n`;
        antiCheatFlags.forEach((f: any) => {
          const flagStr = typeof f === 'string' ? f : `${f.flag} (${f.severity}): ${f.description}`;
          md += `  - 🚨 ${flagStr}\n`;
        });
      }
      md += `\n`;
    }

    md += `---\n\n`;
  });

  return md;
}

export function generateCampaignJsonData(campaign: Campaign, candidates: Candidate[]): string {
  const exportData = {
    campaign: {
      id: campaign.id,
      title: campaign.title,
      department: campaign.department || "General",
      location: campaign.location || "Remote",
      status: campaign.status || "active",
      jobDescription: campaign.jobDescription || "",
      totalCandidates: campaign.total || candidates.length,
      processedCandidates: campaign.processed || candidates.length,
      shortlistedCandidates: campaign.shortlisted || 0,
      totalCost: campaign.totalCost || 0,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
    },
    exportedAt: new Date().toISOString(),
    candidatesCount: candidates.length,
    candidates: candidates.map((cand) => {
      const evalData = cand.evaluation || {};
      return {
        id: cand.id,
        name: cand.name,
        email: cand.email,
        phone: cand.phone,
        stage: cand.stage || cand.status,
        decision: cand.recommendation || cand.decision || "pending",
        score: cand.score ?? cand.fitScore ?? 0,
        scores: cand.scores || {
          technical: evalData.technicalScore || 0,
          communication: evalData.communicationScore || 0,
          culturalFit: evalData.culturalFitScore || 0,
          overall: evalData.overallScore || cand.fitScore || 0,
        },
        currentRole: cand.currentRole || cand.structuredProfile?.currentRole || null,
        experience: cand.experience || cand.structuredProfile?.experience || null,
        structuredProfile: cand.structuredProfile || null,
        strengths: cand.strengths || evalData.strengths || [],
        concerns: cand.concerns || evalData.concerns || [],
        summary: cand.summary || evalData.summary || null,
        chainOfThought: cand.chainOfThought || evalData.chainOfThought || null,
        scoreBreakdown: cand.scoreBreakdown || evalData.scoreBreakdown || null,
        aiGeneratedLikelihoodScore: cand.aiGeneratedLikelihoodScore ?? evalData.aiGeneratedLikelihoodScore ?? 0,
        antiCheatFlags: cand.antiCheatFlags || evalData.antiCheatFlags || [],
        antiCheatMetadata: cand.antiCheatMetadata || evalData.antiCheatMetadata || null,
        apiCost: cand.apiCost || 0,
        costBreakdown: cand.costBreakdown || null,
        transcript: cand.transcript || evalData.interviewTranscript || [],
        cvUrl: cand.cvUrl || cand.resumePath || null,
        createdAt: cand.createdAt,
        updatedAt: cand.updatedAt,
      };
    }),
  };

  return JSON.stringify(exportData, null, 2);
}
