import { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router";
import { ChevronLeft, Briefcase, BarChart2, Users, Settings, LogOut, ArrowLeft, SlidersHorizontal, Bell, Plus } from "lucide-react";
import { Theme } from "../lib/types";
import { getGlass, hexToRgba } from "../lib/theme";
import { useAuth } from "../lib/AuthContext";
import { supabase } from "../lib/supabase";
const logoLightImg = "/Screenshot_2026-07-10_121453-removebg-preview.png";
const logoDarkImg = "/Screenshot_2026-07-10_121508-removebg-preview.png";
import { ThemeEditor } from "../components/common/ThemeEditor";

export default function Layout({ theme, setTheme }: { theme: Theme, setTheme: (t: Theme) => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const G = getGlass(theme);

  // In a real app, this would be dynamic
  const title = location.pathname.includes("/dashboard") ? "Campaigns" :
    location.pathname.includes("/setup") ? "New Campaign" :
      location.pathname.includes("/candidate") ? "Candidate Review" :
        location.pathname.includes("/pipeline") ? "Pipeline" : "Hireagent";

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: theme.bgPage, position: "relative" }}>
      {/* Sidebar */}
      <aside
        className="flex-shrink-0 flex flex-col relative z-10 overflow-hidden"
        style={{ ...G.sidebar, width: collapsed ? "56px" : "224px", transition: "width 0.22s cubic-bezier(0.4,0,0.2,1)" }}
      >
        {/* Logo + collapse toggle */}
        <div className="flex items-center flex-shrink-0 px-3"
          style={{ borderBottom: `1px solid ${hexToRgba(theme.bgCard, theme.isDark ? 0.10 : 0.50)}`, height: "64px", gap: "8px", justifyContent: collapsed ? "center" : "flex-start" }}>
          <img
            src={theme.isDark ? logoDarkImg : logoLightImg}
            alt="hireagent"
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

        {/* User */}
        <div className="px-2 py-3 flex-shrink-0" style={{ borderTop: `1px solid ${hexToRgba(theme.bgCard, theme.isDark ? 0.10 : 0.50)}` }}>
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
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        {/* Top bar */}
        <header className="h-13 flex items-center justify-between px-6 flex-shrink-0" style={G.bar}>
          <div className="flex items-center gap-2.5">
            {!location.pathname.includes("/dashboard") && (
              <button onClick={() => navigate(-1)}
                className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
                style={{ background: hexToRgba(theme.bgCard, theme.isDark ? 0.12 : 0.55), border: `1px solid ${hexToRgba(theme.bgCard, theme.isDark ? 0.20 : 0.80)}`, color: theme.txtSecondary }}>
                <ArrowLeft size={14} />
              </button>
            )}
            <span className="text-sm font-semibold" style={{ color: theme.txtPrimary }}>
              {title}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Theme editor toggle */}
            <button onClick={() => setEditorOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ background: hexToRgba(theme.bgCard, theme.isDark ? 0.12 : 0.52), border: `1px solid ${hexToRgba(theme.bgCard, theme.isDark ? 0.20 : 0.75)}`, color: theme.txtSecondary }}>
              <SlidersHorizontal size={12} />
              <span style={{ color: theme.accentBadge, fontWeight: 600 }}>{theme.name}</span>
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg"
              style={{ background: hexToRgba(theme.bgCard, theme.isDark ? 0.12 : 0.52), border: `1px solid ${hexToRgba(theme.bgCard, theme.isDark ? 0.20 : 0.75)}`, color: theme.txtSecondary }}>
              <Bell size={14} />
            </button>
            {location.pathname.includes("/dashboard") && (
              <button onClick={() => navigate("/setup")}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: `linear-gradient(135deg, ${theme.accentPrimary}, ${hexToRgba(theme.accentPrimary, 0.75)})`, color: theme.accentText, boxShadow: `0 2px 12px ${hexToRgba(theme.accentPrimary, 0.35)}` }}>
                <Plus size={13} />New Campaign
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>

      {/* Theme Editor Panel */}
      {editorOpen && <ThemeEditor theme={theme} onThemeChange={setTheme} onClose={() => setEditorOpen(false)} />}
    </div>
  );
}
