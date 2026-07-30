import React from "react";
import { Mail, Lock } from "lucide-react";
import { Theme } from "../../../lib/types";
import { hexToRgba, getGlass } from "../../../lib/theme";
import { AuthInput } from "./AuthInput";
import { ErrorContainer } from "./ErrorContainer";

export interface LoginFormProps {
  theme: Theme;
  email: string;
  setEmail: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  showPw: boolean;
  setShowPw: React.Dispatch<React.SetStateAction<boolean>>;
  loading: boolean;
  error: string;
  setError: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onSwitchMode: (mode: "login" | "signup") => void;
}

export function LoginForm({
  theme: t,
  email,
  setEmail,
  password,
  setPassword,
  showPw,
  setShowPw,
  loading,
  error,
  setError,
  onSubmit,
  onSwitchMode,
}: LoginFormProps) {
  const G = getGlass(t);

  return (
    <form onSubmit={onSubmit} className="rounded-3xl p-7 flex flex-col gap-4" style={G.cardWarm}>
      <div>
        <h2 className="text-xl font-semibold" style={{ fontFamily: "'Fraunces',serif", color: t.txtPrimary }}>
          Welcome back
        </h2>
        <p className="text-xs mt-0.5" style={{ color: t.txtMuted }}>
          Sign in to your hireagent workspace.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <AuthInput
          theme={t}
          icon={Mail}
          type="email"
          placeholder="Work email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <AuthInput
          theme={t}
          icon={Lock}
          type="password"
          placeholder="Password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          showPasswordToggle
          showPassword={showPw}
          onTogglePassword={() => setShowPw((p) => !p)}
        />
      </div>

      <div className="flex justify-end -mt-1">
        <button
          type="button"
          style={{ color: t.accentPrimary, background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "11px" }}
        >
          Forgot password?
        </button>
      </div>

      <ErrorContainer theme={t} error={error} />

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 mt-1"
        style={{
          background: `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.78)})`,
          color: t.accentText,
          boxShadow: `0 4px 20px ${hexToRgba(t.accentPrimary, 0.35)}`,
          opacity: loading ? 0.75 : 1,
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading && (
          <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
          </svg>
        )}
        {loading ? "Please wait…" : "Sign in"}
      </button>

      <p className="text-center text-[11px]" style={{ color: t.txtMuted }}>
        Don't have an account?{" "}
        <button
          type="button"
          onClick={() => {
            setError("");
            onSwitchMode("signup");
          }}
          style={{ color: t.accentPrimary, background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "11px", fontWeight: 600 }}
        >
          Sign up
        </button>
      </p>
    </form>
  );
}
