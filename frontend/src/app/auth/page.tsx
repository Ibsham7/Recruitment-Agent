import { useState } from "react";
import { useNavigate } from "react-router";
import { Theme } from "../../lib/types";
import { supabase } from "../../lib/supabase";
import { BrandingHeader, LoginForm, SignupForm } from "./components";

export default function AuthPage({ theme: t }: { theme: Theme }) {
  const navigate = useNavigate();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isLogin = mode === "login";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!isLogin && password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!isLogin && !agreedToTerms) {
      setError("You must agree to the Terms of Service and Privacy Policy to create an account.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        navigate("/dashboard");
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
              consent_given_at: new Date().toISOString(),
              terms_version: "v1.0",
              privacy_policy_version: "v1.0",
            },
          },
        });
        if (signUpError) throw signUpError;
        // Depending on settings, email confirmation might be required
        setError("Account created successfully. You can now sign in.");
        setMode("login");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during authentication.");
    } finally {
      setLoading(false);
    }
  };

  const onSwitch = (m: "login" | "signup") => setMode(m);
  const onBack = () => navigate("/");

  return (
    <div className="flex w-full h-screen items-center justify-center relative z-10 px-4" style={{ background: t.bgPage }}>
      <div className="w-full max-w-[420px]">
        <BrandingHeader
          theme={t}
          mode={mode}
          onSwitch={onSwitch}
          onBack={onBack}
          setError={setError}
        />

        {isLogin ? (
          <LoginForm
            theme={t}
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            showPw={showPw}
            setShowPw={setShowPw}
            loading={loading}
            error={error}
            setError={setError}
            onSubmit={handleSubmit}
            onSwitchMode={onSwitch}
          />
        ) : (
          <SignupForm
            theme={t}
            name={name}
            setName={setName}
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            confirm={confirm}
            setConfirm={setConfirm}
            agreedToTerms={agreedToTerms}
            setAgreedToTerms={setAgreedToTerms}
            showPw={showPw}
            setShowPw={setShowPw}
            showConfirm={showConfirm}
            setShowConfirm={setShowConfirm}
            loading={loading}
            error={error}
            setError={setError}
            onSubmit={handleSubmit}
            onSwitchMode={onSwitch}
          />
        )}

        <div className="mt-6 text-center text-xs flex items-center justify-center gap-3" style={{ color: t.txtMuted }}>
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="hover:underline transition-colors" style={{ color: t.accentPrimary }}>
            Terms of Service
          </a>
          <span>•</span>
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="hover:underline transition-colors" style={{ color: t.accentPrimary }}>
            Privacy Policy
          </a>
        </div>
      </div>
    </div>
  );
}
