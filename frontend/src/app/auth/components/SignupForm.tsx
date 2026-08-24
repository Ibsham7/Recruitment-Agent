import React from "react";
import { User, Mail, Lock } from "lucide-react";
import { Theme } from "../../../lib/types";
import { hexToRgba, getGlass } from "../../../lib/theme";
import { AuthInput } from "./AuthInput";
import { ErrorContainer } from "./ErrorContainer";

export interface SignupFormProps {
  theme: Theme;
  name: string;
  setName: (val: string) => void;
  email: string;
  setEmail: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  confirm: string;
  setConfirm: (val: string) => void;
  agreedToTerms: boolean;
  setAgreedToTerms: (val: boolean) => void;
  showPw: boolean;
  setShowPw: React.Dispatch<React.SetStateAction<boolean>>;
  showConfirm: boolean;
  setShowConfirm: React.Dispatch<React.SetStateAction<boolean>>;
  loading: boolean;
  error: string;
  setError: (val: string) => void;
  success?: string;
  setSuccess?: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onSwitchMode: (mode: "login" | "signup") => void;
}

export function SignupForm({
  theme: t,
  name,
  setName,
  email,
  setEmail,
  password,
  setPassword,
  confirm,
  setConfirm,
  agreedToTerms,
  setAgreedToTerms,
  showPw,
  setShowPw,
  showConfirm,
  setShowConfirm,
  loading,
  error,
  setError,
  success,
  setSuccess,
  onSubmit,
  onSwitchMode,
}: SignupFormProps) {
  const G = getGlass(t);

  return (
    <form onSubmit={onSubmit} className="rounded-3xl p-7 flex flex-col gap-4" style={G.cardWarm}>
      <div>
        <h2 className="text-xl font-semibold" style={{ fontFamily: "'Fraunces',serif", color: t.txtPrimary }}>
          Create your account
        </h2>
        <p className="text-xs mt-0.5" style={{ color: t.txtMuted }}>
          Start hiring smarter in minutes.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <AuthInput
          theme={t}
          icon={User}
          type="text"
          placeholder="Full name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
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
        <AuthInput
          theme={t}
          icon={Lock}
          type="password"
          placeholder="Confirm password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          showPasswordToggle
          showPassword={showConfirm}
          onTogglePassword={() => setShowConfirm((p) => !p)}
        />
      </div>

      <div className="flex items-start gap-2.5 px-1 my-0.5">
        <input
          id="recruiter-consent-checkbox"
          type="checkbox"
          checked={agreedToTerms}
          onChange={(e) => setAgreedToTerms(e.target.checked)}
          className="mt-0.5 rounded border-gray-300 cursor-pointer"
          style={{ accentColor: t.accentPrimary }}
          required
        />
        <label htmlFor="recruiter-consent-checkbox" className="text-xs leading-tight select-none cursor-pointer" style={{ color: t.txtMuted }}>
          I agree to the{" "}
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-medium underline hover:opacity-80" style={{ color: t.accentPrimary }}>
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-medium underline hover:opacity-80" style={{ color: t.accentPrimary }}>
            Privacy Policy
          </a>.
        </label>
      </div>

      <ErrorContainer theme={t} error={error} success={success} />

      <button
        type="submit"
        disabled={loading || !agreedToTerms}
        className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 mt-1 transition-all"
        style={{
          background: `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.78)})`,
          color: t.accentText,
          boxShadow: `0 4px 20px ${hexToRgba(t.accentPrimary, 0.35)}`,
          opacity: loading || !agreedToTerms ? 0.55 : 1,
          cursor: loading || !agreedToTerms ? "not-allowed" : "pointer",
        }}
      >
        {loading && (
          <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
          </svg>
        )}
        {loading ? "Please wait…" : "Create account"}
      </button>

      <p className="text-center text-[11px]" style={{ color: t.txtMuted }}>
        Already have an account?{" "}
        <button
          type="button"
          onClick={() => {
            setError("");
            setSuccess?.("");
            onSwitchMode("login");
          }}
          style={{ color: t.accentPrimary, background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "11px", fontWeight: 600 }}
        >
          Sign in
        </button>
      </p>
    </form>
  );
}
