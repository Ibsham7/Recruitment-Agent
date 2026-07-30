import React from "react";
import { Eye, EyeOff, LucideIcon } from "lucide-react";
import { Theme } from "../../../lib/types";
import { hexToRgba } from "../../../lib/theme";

export interface AuthInputProps {
  theme: Theme;
  icon: LucideIcon;
  type: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  showPasswordToggle?: boolean;
  showPassword?: boolean;
  onTogglePassword?: () => void;
}

export function AuthInput({
  theme: t,
  icon: Icon,
  type,
  placeholder,
  value,
  onChange,
  required = false,
  showPasswordToggle = false,
  showPassword = false,
  onTogglePassword,
}: AuthInputProps) {
  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: hexToRgba(t.bgSurface, t.isDark ? 0.60 : 0.55),
    border: `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.28 : 0.80)}`,
    borderRadius: "12px",
    padding: showPasswordToggle ? "11px 38px 11px 38px" : "11px 12px 11px 38px",
    color: t.txtBody,
    fontSize: "13px",
    outline: "none",
  };

  return (
    <div className="relative">
      <Icon size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: t.txtGhost }} />
      <input
        type={showPasswordToggle ? (showPassword ? "text" : "password") : type}
        placeholder={placeholder}
        required={required}
        value={value}
        onChange={onChange}
        style={inputStyle}
      />
      {showPasswordToggle && (
        <button
          type="button"
          onClick={onTogglePassword}
          className="absolute right-3 top-1/2 -translate-y-1/2"
          style={{ color: t.txtGhost, background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 0 }}
        >
          {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
      )}
    </div>
  );
}
