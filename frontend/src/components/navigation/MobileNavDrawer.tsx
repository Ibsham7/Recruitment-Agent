import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router";
import {
  X,
  Briefcase,
  Mail,
  CreditCard,
  ShieldCheck,
  BarChart2,
  Users,
  Settings,
  SlidersHorizontal,
  Sun,
  Moon,
  LogOut,
} from "lucide-react";
import { Theme } from "../../lib/types";
import { PRESETS, hexToRgba } from "../../lib/theme";
import { useAuth } from "../../lib/AuthContext";
import { supabase } from "../../lib/supabase";

interface MobileNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  theme: Theme;
  onOpenThemeEditor: () => void;
  onThemeChange?: (theme: Theme) => void;
}

export function MobileNavDrawer({
  isOpen,
  onClose,
  theme,
  onOpenThemeEditor,
  onThemeChange,
}: MobileNavDrawerProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, isAdmin } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Keyboard Dismissal (Escape key)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Lock background body scroll when drawer is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleDark = () => {
    if (!onThemeChange) return;
    const newDark = !theme.isDark;
    const preset = PRESETS.find((p) => p.name === theme.name);
    if (newDark && preset?.darkVariant) {
      onThemeChange({ ...theme, isDark: true, ...preset.darkVariant });
    } else if (!newDark && preset && preset.isDark === false) {
      onThemeChange({ ...preset, isDark: false });
    } else {
      onThemeChange({ ...theme, isDark: newDark });
    }
  };

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      onClose();
      await supabase.auth.signOut();
      navigate("/");
    } catch (err) {
      console.error("[MobileNavDrawer] Sign out failed:", err);
      setIsSigningOut(false);
    }
  };

  const navItems = [
    {
      id: "campaigns",
      icon: <Briefcase size={16} />,
      label: "Campaigns",
      path: "/dashboard",
      active:
        location.pathname.includes("/dashboard") ||
        location.pathname.includes("/pipeline") ||
        location.pathname.includes("/candidate") ||
        location.pathname.includes("/setup"),
    },
    {
      id: "interviews",
      icon: <Mail size={16} />,
      label: "Interviews",
      path: "/interviews",
      active: location.pathname.includes("/interviews"),
    },
    {
      id: "billing",
      icon: <CreditCard size={16} />,
      label: "Billing & Credits",
      path: "/billing",
      active: location.pathname.includes("/billing"),
    },
    ...(isAdmin
      ? [
          {
            id: "admin",
            icon: <ShieldCheck size={16} />,
            label: "Admin Portal",
            path: "/admin",
            active: location.pathname.includes("/admin"),
          },
        ]
      : []),
    {
      id: "analytics",
      icon: <BarChart2 size={16} />,
      label: "Analytics",
      path: "/notfound",
      active: location.pathname.includes("/analytics"),
    },
    {
      id: "candidates",
      icon: <Users size={16} />,
      label: "Candidates Directory",
      path: "/notfound",
      active: location.pathname.includes("/candidates"),
    },
    {
      id: "settings",
      icon: <Settings size={16} />,
      label: "Settings",
      path: "/notfound",
      active: location.pathname.includes("/settings"),
    },
  ];

  const userInitials = user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : "US";
  const userDisplayName =
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const userEmail = user?.email || "No email";
  const isPaid = profile?.plan === "paid";
  const creditBalance = profile?.creditBalance ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm lg:hidden transition-opacity"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Navigation Menu"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="h-full w-[85vw] max-w-[340px] flex flex-col overflow-hidden shadow-2xl relative animate-in slide-in-from-right duration-200"
        style={{
          background: hexToRgba(theme.bgSurface, theme.isDark ? 0.98 : 0.99),
          backdropFilter: "blur(36px)",
          WebkitBackdropFilter: "blur(36px)",
          borderLeft: `1px solid ${hexToRgba(theme.bgCard, theme.isDark ? 0.15 : 0.6)}`,
        }}
      >
        {/* 1. Sticky Header & Fixed Controls */}
        <div
          className="shrink-0 flex items-center justify-between px-5 py-3.5 border-b z-10"
          style={{
            borderColor: hexToRgba(theme.bgCard, theme.isDark ? 0.12 : 0.5),
            background: hexToRgba(theme.bgSurface, theme.isDark ? 0.98 : 0.99),
            paddingTop: "max(1rem, env(safe-area-inset-top, 0px))",
          }}
        >
          <div>
            <div
              className="text-sm font-bold tracking-tight"
              style={{ color: theme.txtPrimary }}
            >
              Menu & Account
            </div>
            <div className="text-[11px]" style={{ color: theme.txtMuted }}>
              Recruitment Platform
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-all active:scale-95"
            style={{
              background: hexToRgba(theme.bgCard, theme.isDark ? 0.12 : 0.45),
              border: `1px solid ${hexToRgba(theme.bgCard, theme.isDark ? 0.2 : 0.65)}`,
              color: theme.txtSecondary,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* 2. Independent Scroll Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* User Profile Card */}
          <div
            className="p-3.5 rounded-2xl border transition-all"
            style={{
              background: hexToRgba(theme.bgCard, theme.isDark ? 0.1 : 0.45),
              borderColor: hexToRgba(theme.bgCard, theme.isDark ? 0.18 : 0.65),
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold uppercase flex-shrink-0"
                style={{
                  background: hexToRgba(theme.accentBadge, 0.2),
                  color: theme.accentBadge,
                  border: `1px solid ${hexToRgba(theme.accentBadge, 0.35)}`,
                }}
              >
                {userInitials}
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className="text-xs font-semibold truncate"
                  style={{ color: theme.txtPrimary }}
                >
                  {userDisplayName}
                </div>
                <div
                  className="text-[11px] truncate"
                  style={{ color: theme.txtMuted }}
                >
                  {userEmail}
                </div>
              </div>
            </div>

            {/* Quick Plan & Credits Pill (Clickable -> /billing) */}
            <div
              onClick={() => {
                onClose();
                navigate("/billing");
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  onClose();
                  navigate("/billing");
                }
              }}
              aria-label="View billing and credit details"
              className="min-h-[44px] flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all hover:opacity-90 active:scale-[0.98]"
              style={{
                background: isPaid
                  ? hexToRgba(theme.accentBadge, 0.14)
                  : hexToRgba(theme.bgCard, theme.isDark ? 0.2 : 0.65),
                border: `1px solid ${
                  isPaid
                    ? hexToRgba(theme.accentBadge, 0.35)
                    : hexToRgba(theme.txtMuted, 0.25)
                }`,
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                  style={{
                    background: isPaid
                      ? theme.accentBadge
                      : hexToRgba(theme.txtMuted, 0.25),
                    color: isPaid ? "#ffffff" : theme.txtSecondary,
                  }}
                >
                  {isPaid ? "Paid" : "Free"}
                </span>
                <span
                  className="text-xs font-semibold"
                  style={{ color: theme.txtPrimary }}
                >
                  {creditBalance} Credits
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-medium" style={{ color: theme.txtMuted }}>
                  Manage
                </span>
                <CreditCard
                  size={14}
                  style={{ color: isPaid ? theme.accentBadge : theme.txtMuted }}
                />
              </div>
            </div>
          </div>

          {/* Navigation Items Section */}
          <div>
            <div
              className="text-[10px] font-bold uppercase tracking-widest px-1 mb-2"
              style={{ color: theme.txtMuted }}
            >
              Navigation
            </div>
            <div className="space-y-1">
              {navItems.map(({ id, icon, label, path, active }) => (
                <button
                  key={id}
                  onClick={() => {
                    onClose();
                    navigate(path);
                  }}
                  className="w-full min-h-[44px] flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all text-left active:scale-[0.99]"
                  style={{
                    background: active
                      ? hexToRgba(theme.accentBadge, 0.14)
                      : "transparent",
                    color: active ? theme.accentBadge : theme.txtSecondary,
                    border: active
                      ? `1px solid ${hexToRgba(theme.accentBadge, 0.25)}`
                      : "1px solid transparent",
                  }}
                >
                  <span className="flex-shrink-0">{icon}</span>
                  <span className="flex-1 truncate">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Appearance & System Controls Section */}
          <div>
            <div
              className="text-[10px] font-bold uppercase tracking-widest px-1 mb-2"
              style={{ color: theme.txtMuted }}
            >
              Appearance & Controls
            </div>
            <div className="space-y-2">
              {/* Theme Customizer Trigger */}
              <button
                onClick={() => {
                  onClose();
                  onOpenThemeEditor();
                }}
                className="w-full min-h-[44px] flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium border transition-all active:scale-[0.99]"
                style={{
                  background: hexToRgba(theme.bgCard, theme.isDark ? 0.12 : 0.5),
                  borderColor: hexToRgba(theme.bgCard, theme.isDark ? 0.2 : 0.65),
                  color: theme.txtPrimary,
                }}
              >
                <div className="flex items-center gap-2.5">
                  <SlidersHorizontal
                    size={15}
                    style={{ color: theme.accentBadge }}
                  />
                  <span>Customize Theme</span>
                </div>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-md truncate max-w-[120px]"
                  style={{
                    background: hexToRgba(theme.accentBadge, 0.15),
                    color: theme.accentBadge,
                  }}
                >
                  {theme.name}
                </span>
              </button>

              {/* Quick Dark / Light Mode Toggle */}
              <button
                onClick={handleToggleDark}
                className="w-full min-h-[44px] flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium border transition-all active:scale-[0.99]"
                style={{
                  background: hexToRgba(theme.bgCard, theme.isDark ? 0.12 : 0.5),
                  borderColor: hexToRgba(theme.bgCard, theme.isDark ? 0.2 : 0.65),
                  color: theme.txtPrimary,
                }}
              >
                <div className="flex items-center gap-2.5">
                  {theme.isDark ? (
                    <Moon size={15} style={{ color: theme.accentBadge }} />
                  ) : (
                    <Sun size={15} style={{ color: theme.accentBadge }} />
                  )}
                  <span>Mode: {theme.isDark ? "Dark" : "Light"}</span>
                </div>
                <div
                  className="w-9 h-5 rounded-full relative transition-all"
                  style={{
                    background: theme.isDark
                      ? hexToRgba(theme.accentBadge, 0.3)
                      : hexToRgba(theme.bgCard, 0.4),
                    border: `1px solid ${
                      theme.isDark
                        ? hexToRgba(theme.accentBadge, 0.5)
                        : hexToRgba(theme.txtMuted, 0.3)
                    }`,
                  }}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full absolute top-[2px] transition-all"
                    style={{
                      left: theme.isDark ? "19px" : "2px",
                      backgroundColor: theme.isDark
                        ? theme.accentBadge
                        : theme.txtGhost,
                    }}
                  />
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* 3. Sticky Sign Out Footer */}
        <div
          className="shrink-0 p-4 border-t z-10"
          style={{
            borderColor: hexToRgba(theme.bgCard, theme.isDark ? 0.12 : 0.5),
            background: hexToRgba(theme.bgSurface, theme.isDark ? 0.98 : 0.99),
            paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))",
          }}
        >
          <button
            onClick={handleSignOut}
            disabled={isSigningOut}
            aria-label="Sign out"
            className="w-full min-h-[44px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all active:scale-[0.98] disabled:opacity-60"
            style={{
              background: hexToRgba(theme.numNeg, 0.12),
              color: theme.numNeg,
              border: `1px solid ${hexToRgba(theme.numNeg, 0.3)}`,
            }}
          >
            <LogOut size={15} />
            <span>{isSigningOut ? "Signing out..." : "Sign Out"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default MobileNavDrawer;
