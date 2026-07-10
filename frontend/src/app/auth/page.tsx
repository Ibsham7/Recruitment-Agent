import { useState } from "react";
import { useNavigate } from "react-router";
import { User, Mail, Lock, EyeOff, Eye, AlertCircle } from "lucide-react";
import { Theme } from "../../lib/types";
import { hexToRgba, getGlass } from "../../lib/theme";
import { PillNav } from "../../components/common/PillNav";
const logoLightImg = "/Screenshot_2026-07-10_121453-removebg-preview.png";
const logoDarkImg = "/Screenshot_2026-07-10_121508-removebg-preview.png";

export default function AuthPage({ theme: t }: { theme: Theme }) {
  const navigate = useNavigate();
  const G = getGlass(t);
  
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isLogin = mode === "login";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!isLogin && password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      navigate("/dashboard");
    }, 800);
  };

  const onSwitch = (m: "login" | "signup") => setMode(m);
  const onBack = () => navigate("/");

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: hexToRgba(t.bgSurface, t.isDark ? 0.60 : 0.55),
    border: `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.28 : 0.80)}`,
    borderRadius: "12px",
    padding: "11px 12px 11px 38px",
    color: t.txtBody,
    fontSize: "13px",
    outline: "none",
  };

  return (
    <div className="flex w-full h-screen items-center justify-center relative z-10 px-4" style={{ background: t.bgPage }}>

      {/* PillNav — back to landing + mode switch */}
      <PillNav
        containerStyle={{ position: "absolute", top: "1.25rem", left: "50%", transform: "translateX(-50%)" }}
        baseColor={t.isDark ? hexToRgba(t.bgSurface, 0.90) : hexToRgba(t.txtBody, 0.90)}
        pillColor={t.isDark ? hexToRgba(t.bgCard, 0.18) : hexToRgba(t.bgCard, 0.92)}
        pillTextColor={t.txtBody}
        hoveredPillTextColor={t.bgPage}
        items={[
          { label: "← Home",   onClick: onBack },
          { label: "Sign In",  onClick: () => onSwitch("login"),  active: mode === "login" },
          { label: "Sign Up",  onClick: () => onSwitch("signup"), active: mode === "signup" },
        ]}
      />

      <div className="w-full max-w-[420px]">

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img
            src={t.isDark ? logoDarkImg : logoLightImg}
            alt="hireagent"
            style={{ width: "160px", height: "52px", objectFit: "contain" }}
          />
        </div>

        {/* Mode toggle */}
        <div className="flex w-full mb-6 rounded-2xl p-1"
          style={{ background: hexToRgba(t.bgCard, t.isDark ? 0.14 : 0.50), border: `1px solid ${hexToRgba(t.bgCard, t.isDark ? 0.22 : 0.72)}` }}>
          {(["login", "signup"] as const).map((m) => (
            <button key={m} type="button"
              onClick={() => { setError(""); onSwitch(m); }}
              className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: mode === m
                  ? `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.78)})`
                  : "transparent",
                color: mode === m ? t.accentText : t.txtMuted,
                boxShadow: mode === m ? `0 2px 10px ${hexToRgba(t.accentPrimary, 0.30)}` : "none",
              }}>
              {m === "login" ? "Sign In" : "Create Account"}
            </button>
          ))}
        </div>

        {/* Card */}
        <form onSubmit={handleSubmit} className="rounded-3xl p-7 flex flex-col gap-4" style={G.cardWarm}>
          <div>
            <h2 className="text-xl font-semibold" style={{ fontFamily: "'Fraunces',serif", color: t.txtPrimary }}>
              {isLogin ? "Welcome back" : "Create your account"}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: t.txtMuted }}>
              {isLogin ? "Sign in to your hireagent workspace." : "Start hiring smarter in minutes."}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {!isLogin && (
              <div className="relative">
                <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: t.txtGhost }} />
                <input type="text" placeholder="Full name" required value={name}
                  onChange={(e) => setName(e.target.value)} style={inputStyle} />
              </div>
            )}
            <div className="relative">
              <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: t.txtGhost }} />
              <input type="email" placeholder="Work email" required value={email}
                onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
            </div>
            <div className="relative">
              <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: t.txtGhost }} />
              <input
                type={showPw ? "text" : "password"}
                placeholder="Password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ ...inputStyle, paddingRight: "38px" }}
              />
              <button type="button" onClick={() => setShowPw(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: t.txtGhost, background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 0 }}>
                {showPw ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
            {!isLogin && (
              <div className="relative">
                <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: t.txtGhost }} />
                <input
                  type={showConfirm ? "text" : "password"}
                  placeholder="Confirm password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  style={{ ...inputStyle, paddingRight: "38px" }}
                />
                <button type="button" onClick={() => setShowConfirm(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: t.txtGhost, background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 0 }}>
                  {showConfirm ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            )}
          </div>

          {isLogin && (
            <div className="flex justify-end -mt-1">
              <button type="button" style={{ color: t.accentPrimary, background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "11px" }}>
                Forgot password?
              </button>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[11px]"
              style={{ background: hexToRgba(t.numNeg, 0.10), border: `1px solid ${hexToRgba(t.numNeg, 0.25)}`, color: t.numNeg }}>
              <AlertCircle size={12} /> {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 mt-1"
            style={{
              background: `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.78)})`,
              color: t.accentText,
              boxShadow: `0 4px 20px ${hexToRgba(t.accentPrimary, 0.35)}`,
              opacity: loading ? 0.75 : 1,
              cursor: loading ? "not-allowed" : "pointer",
            }}>
            {loading && (
              <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
              </svg>
            )}
            {loading ? "Please wait…" : isLogin ? "Sign in" : "Create account"}
          </button>

          <p className="text-center text-[11px]" style={{ color: t.txtMuted }}>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button type="button"
              onClick={() => { setError(""); onSwitch(isLogin ? "signup" : "login"); }}
              style={{ color: t.accentPrimary, background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "11px", fontWeight: 600 }}>
              {isLogin ? "Sign up" : "Sign in"}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
