import { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router";
import { ChevronLeft, Briefcase, BarChart2, Users, Settings, LogOut, ArrowLeft, SlidersHorizontal, Bell, Plus, Mail, CreditCard, ShieldCheck, Menu } from "lucide-react";
import { Theme } from "../lib/types";
import { getGlass, hexToRgba } from "../lib/theme";
import { useAuth } from "../lib/AuthContext";
import { supabase } from "../lib/supabase";
const logoLightImg = "/Screenshot_2026-07-10_121453-removebg-preview.png";
const logoDarkImg = "/Screenshot_2026-07-10_121508-removebg-preview.png";
import { ThemeEditor } from "../components/common/ThemeEditor";
import { MobileBottomNav } from "../components/navigation/MobileBottomNav";
import { MobileNavDrawer } from "../components/navigation/MobileNavDrawer";

export default function Layout({ theme, setTheme }: { theme: Theme, setTheme: (t: Theme) => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, isAdmin } = useAuth();

  // Close mobile drawer automatically upon navigation route changes
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  const G = getGlass(theme);

  // In a real app, this would be dynamic
  const title = location.pathname.includes("/admin") ? "Admin Portal" :
    location.pathname.includes("/interviews") ? "Interview Management" :
    location.pathname.includes("/billing") ? "Billing & Subscription" :
    location.pathname.includes("/dashboard") ? "Campaigns" :
    location.pathname.includes("/setup") ? "New Campaign" :
      location.pathname.includes("/candidate") ? "Candidate Review" :
        location.pathname.includes("/pipeline") ? "Pipeline" : "AgenticHR";

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: theme.bgPage, position: "relative" }}>
      {/* Sidebar */}
      <aside
        className="hidden lg:flex flex-shrink-0 flex-col relative z-10 overflow-hidden"
        style={{ ...G.sidebar, width: collapsed ? "56px" : "224px", transition: "width 0.22s cubic-bezier(0.4,0,0.2,1)" }}
      >
        {/* Logo + collapse toggle */}
        <div className="flex items-center flex-shrink-0 px-3"
          style={{ borderBottom: `1px solid ${hexToRgba(theme.bgCard, theme.isDark ? 0.10 : 0.50)}`, height: "64px", gap: "8px", justifyContent: collapsed ? "center" : "flex-start" }}>
          <img
            src={theme.isDark ? logoDarkImg : logoLightImg}
            alt="AgenticHR"
            style={{
              width: collapsed ? 0 : "136px", height: "44px", objectFit: "contain", objectPosition: "left center",
              display: "block", flexShrink: 0,
              opacity: collapsed ? 0 : 1,
              transition: "width 0.22s cubic-bezier(0.4,0,0.2,1), opacity 0.15s ease",
              pointerEvents: collapsed ? "none" : "auto",
              overflow: "hidden",
            }}
          />
          <button
            onClick={() => setCollapsed(c => !c)}
            className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            style={{
              background: hexToRgba(theme.bgCard, theme.isDark ? 0.12 : 0.45),
              color: theme.txtMuted,
              border: `1px solid ${hexToRgba(theme.bgCard, theme.isDark ? 0.20 : 0.65)}`,
              marginLeft: collapsed ? 0 : "auto",
            }}
          >
            <ChevronLeft size={13} style={{ transform: collapsed ? "rotate(180deg)" : "none", transition: "transform 0.22s ease" }} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {[
            { icon: <Briefcase size={15} />, label: "Campaigns", active: location.pathname.includes("/dashboard") || location.pathname.includes("/pipeline") || location.pathname.includes("/candidate") || location.pathname.includes("/setup"), fn: () => navigate("/dashboard") },
            { icon: <Mail size={15} />, label: "Interviews", active: location.pathname.includes("/interviews"), fn: () => navigate("/interviews") },
            { icon: <CreditCard size={15} />, label: "Billing", active: location.pathname.includes("/billing"), fn: () => navigate("/billing") },
            ...(isAdmin ? [{ icon: <ShieldCheck size={15} />, label: "Admin Panel", active: location.pathname.includes("/admin"), fn: () => navigate("/admin") }] : []),
            { icon: <BarChart2 size={15} />, label: "Analytics", active: location.pathname.includes("/analytics"), fn: () => navigate("/notfound") },
            { icon: <Users size={15} />, label: "Candidates", active: location.pathname.includes("/candidates"), fn: () => navigate("/notfound") },
            { icon: <Settings size={15} />, label: "Settings", active: location.pathname.includes("/settings"), fn: () => navigate("/notfound") },
          ].map(({ icon, label, active, fn }) => (
            <button key={label} onClick={fn} title={collapsed ? label : undefined}
              className="w-full flex items-center py-2 rounded-xl text-xs font-medium transition-all"
              style={{
                gap: collapsed ? 0 : "10px",
                justifyContent: collapsed ? "center" : "flex-start",
                paddingLeft: collapsed ? "0" : "12px",
                paddingRight: collapsed ? "0" : "12px",
                background: active ? hexToRgba(theme.accentBadge, 0.14) : "transparent",
                color: active ? theme.accentBadge : theme.txtMuted,
                border: active ? `1px solid ${hexToRgba(theme.accentBadge, 0.22)}` : "1px solid transparent",
              }}>
              <span className="flex-shrink-0">{icon}</span>
              <span style={{ overflow: "hidden", whiteSpace: "nowrap", maxWidth: collapsed ? 0 : "120px", opacity: collapsed ? 0 : 1, transition: "max-width 0.22s cubic-bezier(0.4,0,0.2,1), opacity 0.12s ease" }}>
                {label}
              </span>
            </button>
          ))}
        </nav>

        {/* User & Plan/Credit Badge */}
        <div className="px-2 py-3 flex-shrink-0" style={{ borderTop: `1px solid ${hexToRgba(theme.bgCard, theme.isDark ? 0.10 : 0.50)}` }}>
          {/* Plan & Credit Quick Pill */}
          <div
            onClick={() => navigate("/billing")}
            title={collapsed ? `${profile?.plan === 'paid' ? 'Paid Plan' : 'Free Plan'} · ${profile?.creditBalance ?? 0} Credits` : undefined}
            className="w-full mb-2 flex items-center rounded-xl cursor-pointer transition-all hover:opacity-90"
            style={{
              padding: collapsed ? "6px 0" : "6px 10px",
              gap: collapsed ? 0 : "8px",
              justifyContent: collapsed ? "center" : "space-between",
              background: profile?.plan === "paid"
                ? hexToRgba(theme.accentBadge, 0.12)
                : hexToRgba(theme.bgCard, theme.isDark ? 0.15 : 0.6),
              border: `1px solid ${profile?.plan === "paid" ? hexToRgba(theme.accentBadge, 0.3) : hexToRgba(theme.txtMuted, 0.2)}`,
            }}
          >
            {collapsed ? (
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center font-bold text-[10px]"
                style={{
                  color: profile?.plan === "paid" ? theme.accentBadge : theme.txtMuted,
                  background: profile?.plan === "paid" ? hexToRgba(theme.accentBadge, 0.2) : hexToRgba(theme.txtMuted, 0.15),
                }}
              >
                {profile?.plan === "paid" ? "P" : "F"}
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={{
                      background: profile?.plan === "paid" ? theme.accentBadge : hexToRgba(theme.txtMuted, 0.2),
                      color: profile?.plan === "paid" ? "#ffffff" : theme.txtSecondary,
                    }}
                  >
                    {profile?.plan === "paid" ? "Paid" : "Free"}
                  </span>
                  <span className="text-[11px] font-semibold truncate" style={{ color: theme.txtPrimary }}>
                    {profile?.creditBalance ?? 0} Credits
                  </span>
                </div>
                <CreditCard size={12} className="flex-shrink-0" style={{ color: profile?.plan === "paid" ? theme.accentBadge : theme.txtMuted }} />
              </>
            )}
          </div>

          <div className="flex items-center py-2 px-1 rounded-xl"
            style={{ gap: collapsed ? 0 : "10px", justifyContent: collapsed ? "center" : "flex-start" }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 uppercase"
              style={{ background: hexToRgba(theme.accentBadge, 0.18), color: theme.accentBadge, border: `1px solid ${hexToRgba(theme.accentBadge, 0.28)}` }}>
              {user?.email ? user.email.substring(0, 2) : "US"}
            </div>
            <div style={{ overflow: "hidden", maxWidth: collapsed ? 0 : "120px", opacity: collapsed ? 0 : 1, transition: "max-width 0.22s cubic-bezier(0.4,0,0.2,1), opacity 0.12s ease", minWidth: 0 }}>
              <div className="text-xs font-medium truncate" style={{ color: theme.txtPrimary }}>{user?.user_metadata?.full_name || user?.email?.split('@')[0] || "User"}</div>
              <div className="text-[10px] truncate" style={{ color: theme.txtMuted }}>{user?.email || "No email"}</div>
            </div>
          </div>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate("/");
            }}
            title="Sign out"
            className="w-full flex items-center py-1.5 px-1 rounded-xl text-xs font-medium transition-all mt-1"
            style={{ gap: collapsed ? 0 : "8px", justifyContent: collapsed ? "center" : "flex-start", color: theme.txtMuted, background: "transparent" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = hexToRgba(theme.numNeg, 0.10); (e.currentTarget as HTMLElement).style.color = theme.numNeg; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = theme.txtMuted; }}>
            <LogOut size={13} className="flex-shrink-0" />
            <span style={{ overflow: "hidden", whiteSpace: "nowrap", maxWidth: collapsed ? 0 : "80px", opacity: collapsed ? 0 : 1, transition: "max-width 0.22s cubic-bezier(0.4,0,0.2,1), opacity 0.12s ease" }}>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10" style={{ background: theme.bgPage }}>
        {/* Top bar */}
        <header className="h-13 flex items-center justify-between px-3 sm:px-4 lg:px-6 flex-shrink-0" style={G.bar}>
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            {!location.pathname.includes("/dashboard") && (
              <button
                onClick={() => navigate(-1)}
                aria-label="Go back"
                className="min-w-[44px] min-h-[44px] sm:min-w-[32px] sm:min-h-[32px] sm:w-8 sm:h-8 flex items-center justify-center rounded-lg transition-all flex-shrink-0 active:scale-95"
                style={{ background: hexToRgba(theme.bgCard, theme.isDark ? 0.12 : 0.55), border: `1px solid ${hexToRgba(theme.bgCard, theme.isDark ? 0.20 : 0.80)}`, color: theme.txtSecondary }}>
                <ArrowLeft size={16} />
              </button>
            )}
            <span className="text-sm font-semibold truncate" style={{ color: theme.txtPrimary }}>
              {title}
            </span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {/* Theme editor toggle (hidden on mobile <640px, accessible via MobileNavDrawer) */}
            <button
              onClick={() => setEditorOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ background: hexToRgba(theme.bgCard, theme.isDark ? 0.12 : 0.52), border: `1px solid ${hexToRgba(theme.bgCard, theme.isDark ? 0.20 : 0.75)}`, color: theme.txtSecondary }}>
              <SlidersHorizontal size={12} />
              <span style={{ color: theme.accentBadge, fontWeight: 600 }}>{theme.name}</span>
            </button>
            {/* Notifications (hidden on mobile <640px) */}
            <button
              className="hidden sm:flex w-8 h-8 items-center justify-center rounded-lg"
              aria-label="Notifications"
              style={{ background: hexToRgba(theme.bgCard, theme.isDark ? 0.12 : 0.52), border: `1px solid ${hexToRgba(theme.bgCard, theme.isDark ? 0.20 : 0.75)}`, color: theme.txtSecondary }}>
              <Bell size={14} />
            </button>
            {/* New Campaign Action */}
            {location.pathname.includes("/dashboard") && (
              <button
                onClick={() => navigate("/setup")}
                aria-label="New Campaign"
                className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold active:scale-95 transition-all shadow-sm"
                style={{ background: `linear-gradient(135deg, ${theme.accentPrimary}, ${hexToRgba(theme.accentPrimary, 0.75)})`, color: theme.accentText, boxShadow: `0 2px 12px ${hexToRgba(theme.accentPrimary, 0.35)}` }}>
                <Plus size={14} />
                <span className="hidden sm:inline">New Campaign</span>
              </button>
            )}
            {/* Mobile Menu Hamburger Button (Hidden on desktop >=1024px) */}
            <button
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-all active:scale-95"
              style={{
                background: hexToRgba(theme.bgCard, theme.isDark ? 0.12 : 0.52),
                border: `1px solid ${hexToRgba(theme.bgCard, theme.isDark ? 0.20 : 0.75)}`,
                color: theme.txtPrimary,
              }}
            >
              <Menu size={18} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden pb-[calc(4rem+env(safe-area-inset-bottom,0px))] lg:pb-0" style={{ background: theme.bgPage }}>
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (Primary Nav) */}
      <MobileBottomNav theme={theme} />

      {/* Mobile Secondary Slide-Out Drawer */}
      <MobileNavDrawer
        isOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        theme={theme}
        onOpenThemeEditor={() => setEditorOpen(true)}
        onThemeChange={setTheme}
      />

      {/* Theme Editor Panel */}
      {editorOpen && <ThemeEditor theme={theme} onThemeChange={setTheme} onClose={() => setEditorOpen(false)} />}
    </div>
  );
}
