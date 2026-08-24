import test from 'node:test';
import assert from 'node:assert/strict';

// Mock theme object matching frontend/src/lib/theme.ts and types.ts
const mockTheme = {
  name: 'default',
  isDark: true,
  bgPage: '#0f172a',
  bgCard: '#1e293b',
  bgSurface: '#334155',
  txtPrimary: '#f8fafc',
  txtBody: '#e2e8f0',
  txtSecondary: '#94a3b8',
  txtMuted: '#64748b',
  txtGhost: '#475569',
  numHero: '#38bdf8',
  numPos: '#22c55e',
  numMid: '#f59e0b',
  numNeg: '#ef4444',
  accentPrimary: '#6366f1',
  accentText: '#ffffff',
  accentBadge: '#8b5cf6',
  progressFill: '#6366f1',
};

function hexToRgba(hex, alpha = 1) {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Logic mirror of UsageBanner.tsx calculations
function evaluateUsageBannerState(profile, t = mockTheme) {
  if (!profile) {
    return { rendered: false, output: null };
  }

  const isFree = profile.plan === 'free';
  const campaignLimit = 5;
  const cvLimit = 100;
  const interviewLimit = 5;

  const campaignsUsed = profile.totalCampaignsCreated || 0;
  const cvsUsed = profile.totalCvsProcessed || 0;
  const interviewsUsed = profile.totalInterviewsSent || 0;

  const isCampaignLimitReached = campaignsUsed >= campaignLimit;
  const isCvLimitReached = cvsUsed >= cvLimit;
  const isInterviewLimitReached = interviewsUsed >= interviewLimit;
  const isAnyLimitReached = isCampaignLimitReached || isCvLimitReached || isInterviewLimitReached;

  // Progress calculations
  const campaignWidthPct = Math.min(100, (campaignsUsed / campaignLimit) * 100);
  const cvWidthPct = Math.min(100, (cvsUsed / cvLimit) * 100);
  const interviewWidthPct = Math.min(100, (interviewsUsed / interviewLimit) * 100);

  // Background and border styles
  const background = isFree
    ? isAnyLimitReached
      ? `linear-gradient(135deg, ${hexToRgba(t.numNeg, 0.08)}, ${hexToRgba(t.bgCard, 0.85)})`
      : `linear-gradient(135deg, ${hexToRgba(t.accentPrimary, 0.08)}, ${hexToRgba(t.bgCard, 0.85)})`
    : `linear-gradient(135deg, ${hexToRgba(t.accentBadge, 0.08)}, ${hexToRgba(t.bgCard, 0.85)})`;

  const borderColor = isFree
    ? isAnyLimitReached
      ? hexToRgba(t.numNeg, 0.3)
      : hexToRgba(t.accentPrimary, 0.22)
    : hexToRgba(t.accentBadge, 0.22);

  // Paid tier formatting
  const formattedBalance = (profile.creditBalance ?? 0).toLocaleString();
  const formattedLifetimeCvs = (profile.totalCvsProcessed ?? 0).toLocaleString();

  return {
    rendered: true,
    isFree,
    campaignsUsed,
    cvsUsed,
    interviewsUsed,
    campaignLimit,
    cvLimit,
    interviewLimit,
    isCampaignLimitReached,
    isCvLimitReached,
    isInterviewLimitReached,
    isAnyLimitReached,
    campaignWidthPct,
    cvWidthPct,
    interviewWidthPct,
    background,
    borderColor,
    formattedBalance,
    formattedLifetimeCvs,
    badgeText: isFree ? 'Free Tier' : 'Paid Tier',
    limitReachedBadgeVisible: isFree && isAnyLimitReached,
  };
}

test('UsageBanner: profile is null should not render', () => {
  const res = evaluateUsageBannerState(null);
  assert.equal(res.rendered, false);
  assert.equal(res.output, null);
});

test('UsageBanner Free Tier: Zero usage (0/5, 0/100, 0/5)', () => {
  const profile = {
    id: 'user-1',
    userId: 'u1',
    email: 'free@test.com',
    plan: 'free',
    creditBalance: 0,
    totalCampaignsCreated: 0,
    totalCvsProcessed: 0,
    totalInterviewsSent: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const state = evaluateUsageBannerState(profile);
  assert.equal(state.rendered, true);
  assert.equal(state.isFree, true);
  assert.equal(state.campaignsUsed, 0);
  assert.equal(state.cvsUsed, 0);
  assert.equal(state.interviewsUsed, 0);
  assert.equal(state.campaignWidthPct, 0);
  assert.equal(state.cvWidthPct, 0);
  assert.equal(state.interviewWidthPct, 0);
  assert.equal(state.isCampaignLimitReached, false);
  assert.equal(state.isCvLimitReached, false);
  assert.equal(state.isInterviewLimitReached, false);
  assert.equal(state.isAnyLimitReached, false);
  assert.equal(state.limitReachedBadgeVisible, false);
  assert.ok(state.background.includes('rgba(99, 102, 241, 0.08)')); // accentPrimary
});

test('UsageBanner Free Tier: Partial usage below limits (2/5, 50/100, 3/5)', () => {
  const profile = {
    id: 'user-2',
    userId: 'u2',
    email: 'free2@test.com',
    plan: 'free',
    creditBalance: 0,
    totalCampaignsCreated: 2,
    totalCvsProcessed: 50,
    totalInterviewsSent: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const state = evaluateUsageBannerState(profile);
  assert.equal(state.rendered, true);
  assert.equal(state.campaignWidthPct, 40); // 2/5 = 40%
  assert.equal(state.cvWidthPct, 50); // 50/100 = 50%
  assert.equal(state.interviewWidthPct, 60); // 3/5 = 60%
  assert.equal(state.isCampaignLimitReached, false);
  assert.equal(state.isCvLimitReached, false);
  assert.equal(state.isInterviewLimitReached, false);
  assert.equal(state.isAnyLimitReached, false);
  assert.equal(state.limitReachedBadgeVisible, false);
});

test('UsageBanner Free Tier: Boundary exactly at 1 below limits (4/5, 99/100, 4/5)', () => {
  const profile = {
    id: 'user-3',
    userId: 'u3',
    email: 'free3@test.com',
    plan: 'free',
    creditBalance: 0,
    totalCampaignsCreated: 4,
    totalCvsProcessed: 99,
    totalInterviewsSent: 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const state = evaluateUsageBannerState(profile);
  assert.equal(state.campaignWidthPct, 80); // 4/5 = 80%
  assert.equal(state.cvWidthPct, 99); // 99/100 = 99%
  assert.equal(state.interviewWidthPct, 80); // 4/5 = 80%
  assert.equal(state.isCampaignLimitReached, false);
  assert.equal(state.isCvLimitReached, false);
  assert.equal(state.isInterviewLimitReached, false);
  assert.equal(state.isAnyLimitReached, false);
});

test('UsageBanner Free Tier: Boundary exactly at limit (5/5, 100/100, 5/5)', () => {
  const profile = {
    id: 'user-4',
    userId: 'u4',
    email: 'free4@test.com',
    plan: 'free',
    creditBalance: 0,
    totalCampaignsCreated: 5,
    totalCvsProcessed: 100,
    totalInterviewsSent: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const state = evaluateUsageBannerState(profile);
  assert.equal(state.campaignWidthPct, 100);
  assert.equal(state.cvWidthPct, 100);
  assert.equal(state.interviewWidthPct, 100);
  assert.equal(state.isCampaignLimitReached, true);
  assert.equal(state.isCvLimitReached, true);
  assert.equal(state.isInterviewLimitReached, true);
  assert.equal(state.isAnyLimitReached, true);
  assert.equal(state.limitReachedBadgeVisible, true);
  assert.ok(state.background.includes('rgba(239, 68, 68, 0.08)')); // numNeg (red alert)
  assert.ok(state.borderColor.includes('rgba(239, 68, 68, 0.3)'));
});

test('UsageBanner Free Tier: Single limit reached (e.g. only campaigns exhausted: 5/5, 20/100, 1/5)', () => {
  const profile = {
    id: 'user-5',
    userId: 'u5',
    email: 'free5@test.com',
    plan: 'free',
    creditBalance: 0,
    totalCampaignsCreated: 5,
    totalCvsProcessed: 20,
    totalInterviewsSent: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const state = evaluateUsageBannerState(profile);
  assert.equal(state.isCampaignLimitReached, true);
  assert.equal(state.isCvLimitReached, false);
  assert.equal(state.isInterviewLimitReached, false);
  assert.equal(state.isAnyLimitReached, true);
  assert.equal(state.limitReachedBadgeVisible, true);
  assert.equal(state.campaignWidthPct, 100);
  assert.equal(state.cvWidthPct, 20);
  assert.equal(state.interviewWidthPct, 20);
});

test('UsageBanner Free Tier: Usage exceeding limit (>100% overflow clamp)', () => {
  const profile = {
    id: 'user-6',
    userId: 'u6',
    email: 'free6@test.com',
    plan: 'free',
    creditBalance: 0,
    totalCampaignsCreated: 10,
    totalCvsProcessed: 250,
    totalInterviewsSent: 15,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const state = evaluateUsageBannerState(profile);
  // Must clamp at 100%
  assert.equal(state.campaignWidthPct, 100);
  assert.equal(state.cvWidthPct, 100);
  assert.equal(state.interviewWidthPct, 100);
  assert.equal(state.isAnyLimitReached, true);
});

test('UsageBanner Free Tier: Undefined or missing counters fallback to 0', () => {
  const profile = {
    id: 'user-7',
    userId: 'u7',
    email: 'free7@test.com',
    plan: 'free',
    creditBalance: 0,
    totalCampaignsCreated: undefined,
    totalCvsProcessed: null,
    totalInterviewsSent: undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const state = evaluateUsageBannerState(profile);
  assert.equal(state.campaignsUsed, 0);
  assert.equal(state.cvsUsed, 0);
  assert.equal(state.interviewsUsed, 0);
  assert.equal(state.campaignWidthPct, 0);
  assert.equal(state.cvWidthPct, 0);
  assert.equal(state.interviewWidthPct, 0);
  assert.equal(state.isAnyLimitReached, false);
});

test('UsageBanner Paid Tier: 0 credit balance rendering', () => {
  const profile = {
    id: 'user-8',
    userId: 'u8',
    email: 'paid1@test.com',
    plan: 'paid',
    creditBalance: 0,
    totalCampaignsCreated: 12,
    totalCvsProcessed: 340,
    totalInterviewsSent: 25,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const state = evaluateUsageBannerState(profile);
  assert.equal(state.isFree, false);
  assert.equal(state.badgeText, 'Paid Tier');
  assert.equal(state.formattedBalance, '0');
  assert.equal(state.formattedLifetimeCvs, '340');
  assert.ok(state.background.includes('rgba(139, 92, 246, 0.08)')); // accentBadge
  assert.ok(state.borderColor.includes('rgba(139, 92, 246, 0.22)'));
});

test('UsageBanner Paid Tier: Positive credit balance rendering with formatting', () => {
  const profile = {
    id: 'user-9',
    userId: 'u9',
    email: 'paid2@test.com',
    plan: 'paid',
    creditBalance: 12500,
    totalCampaignsCreated: 50,
    totalCvsProcessed: 4520,
    totalInterviewsSent: 120,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const state = evaluateUsageBannerState(profile);
  assert.equal(state.isFree, false);
  assert.equal(state.badgeText, 'Paid Tier');
  assert.equal(state.formattedBalance, '12,500');
  assert.equal(state.formattedLifetimeCvs, '4,520');
});

test('UsageBanner Paid Tier: Null / undefined credit balance fallback to 0', () => {
  const profile = {
    id: 'user-10',
    userId: 'u10',
    email: 'paid3@test.com',
    plan: 'paid',
    creditBalance: null,
    totalCampaignsCreated: 5,
    totalCvsProcessed: undefined,
    totalInterviewsSent: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const state = evaluateUsageBannerState(profile);
  assert.equal(state.formattedBalance, '0');
  assert.equal(state.formattedLifetimeCvs, '0');
});
