import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  Hexagon,
  Eye,
  EyeOff,
  Github,
  LockKeyhole,
  Mail,
  UserRound,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";

function AuthFrame({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="auth-layout">
      <section className="auth-panel">
        <Link className="auth-brand" to="/">
          <span className="auth-brand-icon">
            <Hexagon size={25} />
          </span>
          <span>
            Crystal<span className="brand-light">Forge</span> <small>AI</small>
          </span>
        </Link>
        <div className="auth-form-wrap">
          <h1>{title}</h1>
          <p className="auth-subtitle">{subtitle}</p>
          {children}
        </div>
        <div className="auth-foot">
          <span>© {new Date().getFullYear()} CrystalForge AI</span>
          <Link to="/">Explore the platform</Link>
        </div>
      </section>
    </div>
  );
}

function AuthMessage({
  children,
  error = false,
}: {
  children: React.ReactNode;
  error?: boolean;
}) {
  return (
    <div
      className={error ? "auth-message error" : "auth-message"}
      role={error ? "alert" : "status"}
    >
      {children}
    </div>
  );
}

export function Login() {
  const {
    client,
    user,
    loading,
    configError,
    setRememberSession,
    recordLogin,
  } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(
    () => window.localStorage.getItem("cf-auth-remember") !== "false",
  );
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [providerError, setProviderError] = useState("");
  if (!loading && user) return <Navigate to="/dashboard" replace />;
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!client) {
      setError(configError || "Authentication is not configured yet.");
      return;
    }
    setBusy(true);
    try {
      setRememberSession(remember);
      const { data, error: err } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (err) throw err;
      if (data.user) {
        await recordLogin("email").catch(() => undefined);
      }
      const target =
        (loc.state as { from?: string } | null)?.from || "/dashboard";
      nav(target, { replace: true });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Sign in failed. Check your details and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function oauth(provider: "google" | "github") {
    setError("");
    setProviderError("");
    if (!client || busy) return;
    const label = provider === "google" ? "Google" : "GitHub";
    setBusy(true);
    let redirecting = false;
    try {
      const signal = AbortSignal.timeout(8000);
      const configResponse = await fetch("/api/auth/config", { signal });
      if (!configResponse.ok) throw new Error("Auth configuration unavailable");
      const config = await configResponse.json();
      const settingsResponse = await fetch(
        `${config.supabase_url.replace(/\/$/, "")}/auth/v1/settings`,
        { headers: { apikey: config.publishable_key }, signal },
      );
      if (!settingsResponse.ok) throw new Error("Provider settings unavailable");
      const settings = await settingsResponse.json();
      if (settings.external?.[provider] !== true) {
        setProviderError(`${label} sign-in is currently unavailable. Please sign in with email.`);
        return;
      }

      setRememberSession(remember);
      const { data, error: err } = await client.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          skipBrowserRedirect: true,
        },
      });
      if (err || !data.url) throw err ?? new Error("Missing sign-in URL");
      window.location.assign(data.url);
      redirecting = true;
    } catch {
      setProviderError(`Could not start ${label} sign-in. Try again or sign in with email.`);
    } finally {
      if (!redirecting) setBusy(false);
    }
  }
  return (
    <AuthFrame
      title="Welcome back"
      subtitle="Sign in to continue your materials research."
    >
      {configError && (
        <AuthMessage error>
          {configError} Ask the project administrator to configure Supabase.
        </AuthMessage>
      )}
      {providerError && <AuthMessage error>{providerError}</AuthMessage>}
      <div className="auth-social">
        <button
          type="button"
          disabled={busy || !client}
          onClick={() => oauth("google")}
        >
          <span className="google-g">G</span>Continue with Google
        </button>
        <button
          type="button"
          disabled={busy || !client}
          onClick={() => oauth("github")}
        >
          <Github size={17} />
          Continue with GitHub
        </button>
      </div>
      <div className="auth-divider">
        <span>or sign in with email</span>
      </div>
      <form onSubmit={submit} className="auth-form">
        <label>
          Email address
          <span className="auth-input">
            <Mail size={17} />
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </span>
        </label>
        <label>
          Password
          <span className="auth-input">
            <LockKeyhole size={17} />
            <input
              type={show ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
            />
            <button
              type="button"
              className="auth-eye"
              aria-label={show ? "Hide password" : "Show password"}
              onClick={() => setShow(!show)}
            >
              {show ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </span>
        </label>
        <div className="auth-options">
          <label className="auth-check">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            Remember me
          </label>
          <Link to="/forgot-password">Forgot password?</Link>
        </div>
        {error && <AuthMessage error>{error}</AuthMessage>}
        <button className="auth-submit" disabled={busy || !client}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="auth-switch">
        New to CrystalForge? <Link to="/register">Create an account</Link>
      </p>
    </AuthFrame>
  );
}

export function Register() {
  const { client, user, loading, configError, recordLogin } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [terms, setTerms] = useState(false);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  if (!loading && user) return <Navigate to="/dashboard" replace />;
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!client) {
      setError(configError || "Authentication is not configured yet.");
      return;
    }
    if (
      password.length < 12 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[!@#$%^&*(),.?":{}|<>_\-]/.test(password)
    ) {
      setError(
        "Use at least 12 characters with uppercase, lowercase, number, and symbol.",
      );
      return;
    }
    if (password !== confirm) {
      setError("The passwords do not match.");
      return;
    }
    if (!terms) {
      setError("Accept the terms to create your account.");
      return;
    }
    setBusy(true);
    try {
      const { data, error: err } = await client.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: name.trim() },
          emailRedirectTo: `${window.location.origin}/verify-email`,
        },
      });
      if (err) throw err;
      if (data.session) {
        await recordLogin("email").catch(() => undefined);
        nav("/dashboard", { replace: true });
      } else setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Account creation failed.");
    } finally {
      setBusy(false);
    }
  }
  if (sent)
    return (
      <AuthFrame
        title="Check your inbox"
        subtitle="One quick verification step and your research workspace is ready."
      >
        <AuthMessage>
          We sent a confirmation link to <b>{email}</b>. Follow it to verify
          your email, then sign in.
        </AuthMessage>
        <Link className="auth-submit auth-submit-link" to="/login">
          Back to sign in
        </Link>
      </AuthFrame>
    );
  return (
    <AuthFrame
      title="Create your account"
      subtitle="Save your materials work and continue across devices."
    >
      {configError && <AuthMessage error>{configError}</AuthMessage>}
      <form onSubmit={submit} className="auth-form">
        <label>
          Full name
          <span className="auth-input">
            <UserRound size={17} />
            <input
              autoComplete="name"
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </span>
        </label>
        <label>
          Email address
          <span className="auth-input">
            <Mail size={17} />
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </span>
        </label>
        <label>
          Password
          <span className="auth-input">
            <LockKeyhole size={17} />
            <input
              type={show ? "text" : "password"}
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 12 characters"
            />
            <button
              type="button"
              className="auth-eye"
              onClick={() => setShow(!show)}
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </span>
        </label>
        <p className="auth-password-help">Use 12 or more characters, including uppercase, lowercase, a number, and a symbol.</p>
        <label>
          Confirm password
          <span className="auth-input">
            <LockKeyhole size={17} />
            <input
              type={show ? "text" : "password"}
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter password"
            />
          </span>
        </label>
        <label className="auth-check auth-terms">
          <input
            type="checkbox"
            checked={terms}
            onChange={(e) => setTerms(e.target.checked)}
          />
          I agree to the <Link to="/terms">Terms of Use</Link> and privacy
          notice.
        </label>
        {error && <AuthMessage error>{error}</AuthMessage>}
        <button className="auth-submit" disabled={busy || !client}>
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="auth-switch">
        Already registered? <Link to="/login">Sign in</Link>
      </p>
    </AuthFrame>
  );
}

export function ForgotPassword() {
  const { client, user, loading, configError } = useAuth();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  if (!loading && user) return <Navigate to="/dashboard" replace />;
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!client) {
      setError(configError || "Authentication is not configured yet.");
      return;
    }
    setBusy(true);
    try {
      const { error: err } = await client.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: `${window.location.origin}/reset-password` },
      );
      if (err) throw err;
      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Password reset could not be requested.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthFrame
      title={sent ? "Check your email" : "Reset your password"}
      subtitle={
        sent
          ? "If an account exists for that address, a reset link is on its way."
          : "Enter the email address associated with your account."
      }
    >
      {configError && <AuthMessage error>{configError}</AuthMessage>}
      {sent ? (
        <>
          <AuthMessage>
            Password reset instructions have been sent to <b>{email}</b>.
          </AuthMessage>
          <Link className="auth-submit auth-submit-link" to="/login">
            Return to sign in
          </Link>
        </>
      ) : (
        <form onSubmit={submit} className="auth-form">
          <label>
            Email address
            <span className="auth-input">
              <Mail size={17} />
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </span>
          </label>
          {error && <AuthMessage error>{error}</AuthMessage>}
          <button className="auth-submit" disabled={busy || !client}>
            {busy ? "Sending…" : "Send reset link"}
          </button>
          <p className="auth-switch">
            <Link to="/login">Back to sign in</Link>
          </p>
        </form>
      )}
    </AuthFrame>
  );
}

export function ResetPassword() {
  const { client, loading, user } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  if (loading)
    return <div className="auth-loading">Checking secure reset link…</div>;
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (
      password.length < 12 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[!@#$%^&*(),.?":{}|<>_\-]/.test(password)
    ) {
      setError(
        "Use at least 12 characters with uppercase, lowercase, number, and symbol.",
      );
      return;
    }
    if (password !== confirm) {
      setError("The passwords do not match.");
      return;
    }
    if (!client) {
      setError("Authentication is not configured.");
      return;
    }
    setBusy(true);
    try {
      const { error: err } = await client.auth.updateUser({ password });
      if (err) throw err;
      setDone(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "This reset link is invalid or has expired. Request another one.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthFrame
      title={done ? "Password updated" : "Choose a new password"}
      subtitle="Use a strong password you have not used elsewhere."
    >
      {done ? (
        <>
          <AuthMessage>Your password has been updated.</AuthMessage>
          <Link
            className="auth-submit auth-submit-link"
            to={user ? "/dashboard" : "/login"}
          >
            Continue
          </Link>
        </>
      ) : (
        <form onSubmit={submit} className="auth-form">
          <label>
            New password
            <span className="auth-input">
              <LockKeyhole size={17} />
              <input
                type={show ? "text" : "password"}
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 12 characters"
              />
              <button
                type="button"
                className="auth-eye"
                onClick={() => setShow(!show)}
                aria-label="Toggle password visibility"
              >
                {show ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </span>
          </label>
          <label>
            Confirm password
            <span className="auth-input">
              <LockKeyhole size={17} />
              <input
                type={show ? "text" : "password"}
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter password"
              />
            </span>
          </label>
          {error && <AuthMessage error>{error}</AuthMessage>}
          <button className="auth-submit" disabled={busy || !client}>
            {busy ? "Updating…" : "Update password"}
          </button>
        </form>
      )}
    </AuthFrame>
  );
}

export function VerifyEmail() {
  return (
    <AuthFrame
      title="Email verification"
      subtitle="Complete account verification from the email we sent you."
    >
      <AuthMessage>
        When verification succeeds, return here and sign in to access your
        CrystalForge workspace.
      </AuthMessage>
      <Link className="auth-submit auth-submit-link" to="/login">
        Continue to sign in
      </Link>
      <p className="auth-switch">
        Need another link?{" "}
        <Link to="/forgot-password">Request password reset</Link>
      </p>
    </AuthFrame>
  );
}

export function AuthCallback() {
  const { loading, user, recordLogin } = useAuth();
  const nav = useNavigate();
  const handled = useRef(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (loading || handled.current) return;
    if (!user) {
      setFailed(true);
      return;
    }
    handled.current = true;
    void recordLogin(String(user.app_metadata.provider || "oauth"))
      .catch(() => undefined)
      .finally(() => nav("/dashboard", { replace: true }));
  }, [loading, user, recordLogin, nav]);
  if (failed)
    return (
      <AuthFrame
        title="Sign-in could not finish"
        subtitle="The provider may not be enabled or this callback link may have expired."
      >
        <AuthMessage error>
          Please try again. If this continues, check OAuth redirect settings in
          Supabase.
        </AuthMessage>
        <Link className="auth-submit auth-submit-link" to="/login">
          Return to sign in
        </Link>
      </AuthFrame>
    );
  return <div className="auth-loading">Completing secure sign in…</div>;
}
