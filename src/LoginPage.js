import { useState } from "react";
import { useAuth } from "./AuthContext";

export default function LoginPage({ onClose }) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const { error: err } = mode === "signin"
        ? await signIn(email, password)
        : await signUp(email, password);
      if (err) { setError(err.message); }
      else if (mode === "signup") {
        setInfo("Account created! Check your email to confirm, then sign in.");
        setMode("signin");
      } else {
        onClose();
      }
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  const S = {
    overlay: {
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center",
    },
    card: {
      background: "#fff", borderRadius: 14, padding: "32px 36px", width: 380,
      boxShadow: "0 8px 40px rgba(0,0,0,0.18)", position: "relative",
    },
    close: {
      position: "absolute", top: 14, right: 16, background: "none", border: "none",
      fontSize: 20, cursor: "pointer", color: "#aaa", lineHeight: 1,
    },
    tabs: { display: "flex", gap: 0, marginBottom: 24, borderBottom: "1px solid #e5e7eb" },
    tab: (active) => ({
      flex: 1, textAlign: "center", padding: "8px 0", fontSize: 14, fontWeight: 600,
      cursor: "pointer", background: "none", border: "none",
      borderBottom: active ? "2px solid #2a9d5c" : "2px solid transparent",
      color: active ? "#2a9d5c" : "#6b7280",
    }),
    label: { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 },
    input: {
      width: "100%", padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: 7,
      fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 14,
      fontFamily: "system-ui, sans-serif",
    },
    btn: {
      width: "100%", padding: "10px 0", background: "#2a9d5c", color: "#fff",
      border: "none", borderRadius: 7, fontSize: 14, fontWeight: 700,
      cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
    },
    error: { color: "#dc2626", fontSize: 13, marginTop: 10, textAlign: "center" },
    info:  { color: "#2a9d5c", fontSize: 13, marginTop: 10, textAlign: "center" },
    footer: { marginTop: 18, textAlign: "center", fontSize: 12, color: "#9ca3af" },
  };

  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={S.card}>
        <button style={S.close} onClick={onClose}>×</button>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: "#111122", marginBottom: 4 }}>
            MACRORADAR.IN
          </div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>
            {mode === "signin" ? "Sign in to your account" : "Create your account"}
          </div>
        </div>

        <div style={S.tabs}>
          <button style={S.tab(mode === "signin")} onClick={() => { setMode("signin"); setError(""); setInfo(""); }}>
            Sign In
          </button>
          <button style={S.tab(mode === "signup")} onClick={() => { setMode("signup"); setError(""); setInfo(""); }}>
            Create Account
          </button>
        </div>

        <form onSubmit={submit}>
          <label style={S.label}>Email address</label>
          <input
            style={S.input} type="email" required placeholder="you@example.com"
            value={email} onChange={e => setEmail(e.target.value)}
          />
          <label style={S.label}>Password</label>
          <input
            style={S.input} type="password" required placeholder="••••••••"
            minLength={6} value={password} onChange={e => setPassword(e.target.value)}
          />
          <button style={S.btn} type="submit" disabled={loading}>
            {loading ? "Please wait..." : mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>

        {error && <div style={S.error}>{error}</div>}
        {info  && <div style={S.info}>{info}</div>}

        <div style={S.footer}>
          AI features (Analyst + Playbook) require a <strong>Pro subscription — $100/month</strong>
        </div>
      </div>
    </div>
  );
}
