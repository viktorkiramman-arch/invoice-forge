import { useState, type FormEvent } from "react";
import { api, ApiError } from "../lib/api";

export function LoginPage({ onLogin }: { onLogin: () => Promise<void> }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [displayName, setDisplayName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("demo@invoiceforge.local");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await api(`/auth/${mode === "login" ? "login" : "register"}`, {
        method: "POST",
        body: JSON.stringify(mode === "login" ? { email, password } : { displayName, businessName, email, password }),
      });
      await onLogin();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Unable to continue.");
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = (next: "login" | "register") => {
    setMode(next);
    setError("");
    if (next === "register") {
      setEmail("");
      setPassword("");
    } else {
      setEmail("demo@invoiceforge.local");
      setPassword("demo1234");
    }
  };

  return (
    <div className="login-layout">
      <section className="login-brand-panel">
        <div className="login-logo">
          <img src="/favicon.svg" alt="" />
          Invoice Forge
        </div>
        <div className="login-message">
          <span className="eyebrow light">Professional invoicing</span>
          <h1>
            Precise invoices.
            <br />
            Clear payment history.
          </h1>
          <p>Create, finalize, duplicate, and download polished invoices without spreadsheet errors.</p>
        </div>
        <div className="login-proof">
          <strong>Decimal-safe calculations</strong>
          <span>Inclusive taxes, discounts, rounding, and PDF snapshots.</span>
        </div>
      </section>
      <main className="login-form-panel">
        <form className="login-card" onSubmit={submit}>
          <div className="auth-tabs" role="tablist" aria-label="Account access">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "login"}
              className={mode === "login" ? "active" : ""}
              onClick={() => switchMode("login")}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "register"}
              className={mode === "register" ? "active" : ""}
              onClick={() => switchMode("register")}
            >
              Create account
            </button>
          </div>
          <div>
            <span className="eyebrow">{mode === "login" ? "Demo workspace" : "New workspace"}</span>
            <h2>{mode === "login" ? "Sign in" : "Create your account"}</h2>
            <p>
              {mode === "login"
                ? "Use the seeded account or your own workspace."
                : "Set up a private owner workspace with invoice defaults."}
            </p>
          </div>
          {error ? (
            <div className="alert error" role="alert">
              {error}
            </div>
          ) : null}
          {mode === "register" ? (
            <div className="form-grid two">
              <label className="field">
                <span>Your name</span>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  required
                  minLength={2}
                />
              </label>
              <label className="field">
                <span>Business name</span>
                <input
                  value={businessName}
                  onChange={(event) => setBusinessName(event.target.value)}
                  required
                  minLength={2}
                />
              </label>
            </div>
          ) : null}
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={8}
            />
          </label>
          <button className="button primary large" disabled={submitting}>
            {submitting ? "Submitting…" : mode === "login" ? "Sign in" : "Create workspace"}
          </button>
          {mode === "login" ? (
            <div className="demo-credentials">
              <span>Demo email</span>
              <code>demo@invoiceforge.local</code>
              <span>Password</span>
              <code>demo1234</code>
            </div>
          ) : null}
        </form>
      </main>
    </div>
  );
}
