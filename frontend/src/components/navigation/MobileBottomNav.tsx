import { useNavigate, useLocation } from "react-router";
import { Briefcase, Mail, CreditCard } from "lucide-react";
import { Theme } from "../../lib/types";
import { getGlass, hexToRgba } from "../../lib/theme";

interface MobileBottomNavProps {
  theme: Theme;
}

export function MobileBottomNav({ theme }: MobileBottomNavProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const G = getGlass(theme);

  const navItems = [
    {
      id: "campaigns",
      icon: <Briefcase size={18} />,
      label: "Campaigns",
      active:
        location.pathname.includes("/dashboard") ||
        location.pathname.includes("/pipeline") ||
        location.pathname.includes("/candidate") ||
        location.pathname.includes("/setup"),
      fn: () => navigate("/dashboard"),
    },
    {
      id: "interviews",
      icon: <Mail size={18} />,
      label: "Interviews",
      active: location.pathname.includes("/interviews"),
      fn: () => navigate("/interviews"),
    },
    {
      id: "billing",
      icon: <CreditCard size={18} />,
      label: "Billing",
      active: location.pathname.includes("/billing"),
      fn: () => navigate("/billing"),
    },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 lg:hidden flex items-center justify-around px-2 py-1.5 transition-all"
      style={{
        ...G.bar,
        background: hexToRgba(theme.bgSurface, theme.isDark ? 0.95 : 0.98),
        borderTop: `1px solid ${hexToRgba(theme.bgCard, theme.isDark ? 0.15 : 0.60)}`,
        boxShadow: theme.isDark
          ? "0 -4px 20px rgba(0,0,0,0.4)"
          : "0 -4px 20px rgba(0,0,0,0.06)",
        paddingBottom: "max(0.375rem, env(safe-area-inset-bottom, 0px))",
      }}
      aria-label="Mobile Bottom Navigation"
    >
      {navItems.map(({ id, icon, label, active, fn }) => (
        <button
          key={id}
          onClick={fn}
          aria-label={label}
          aria-current={active ? "page" : undefined}
          className="flex-1 min-h-[44px] flex flex-col items-center justify-center gap-1 py-1 px-2 rounded-xl transition-all active:scale-95 select-none focus:outline-none"
          style={{
            color: active ? theme.accentBadge : theme.txtMuted,
            background: active ? hexToRgba(theme.accentBadge, 0.12) : "transparent",
            border: active
              ? `1px solid ${hexToRgba(theme.accentBadge, 0.25)}`
              : "1px solid transparent",
          }}
        >
          <span className="flex-shrink-0">{icon}</span>
          <span className="text-[10px] font-medium tracking-tight leading-none">
            {label}
          </span>
        </button>
      ))}
    </nav>
  );
}

export default MobileBottomNav;
