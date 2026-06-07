import { useState } from "react";
import { useAuth } from "./AuthContext";

export default function SubscribeModal({ onClose }) {
  const { openCheckout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubscribe = async () => {
    setLoading(true);
    setError("");
    try {
      await openCheckout();
    } catch (e) {
      setError("Could not start checkout. Please try again.");
      setLoading(false);
    }
  };

  const S = {
    overlay: {
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center",
    },
    card: {
      background: "#fff", borderRadius: 14, padding: "32px 36px", width: 420,
      boxShadow: "0 8px 40px rgba(0,0,0,0.18)", position: "relative",
    },
    close: {
      position: "absolute", top: 14, right: 16, background: "none", border: "none",
      fontSize: 20, cursor: "pointer", color: "#aaa", lineHeight: 1,
    },
    badge: {
      display: "inline-block", background: "#f0fdf4", color: "#2a9d5c",
      fontWeight: 700, fontSize: 11, padding: "3px 10px", borderRadius: 20,
      border: "1px solid #bbf7d0", marginBottom: 14,
    },
    price: {
      fontSize: 42, fontWeight: 800, color: "#111122", lineHeight: 1,
    },
    period: { fontSize: 14, color: "#6b7280", marginLeft: 4 },
    feature: {
      display: "flex", alignItems: "center", gap: 8,
      fontSize: 14, color: "#374151", marginBottom: 9,
    },
    check: { color: "#2a9d5c", fontWeight: 700, fontSize: 15 },
    btn: {
      width: "100%", padding: "12px 0", background: "#2a9d5c", color: "#fff",
      border: "none", borderRadius: 8, fontSize: 15, fontWeight: 700,
      cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
      marginTop: 20,
    },
    cancel: {
      display: "block", textAlign: "center", marginTop: 12, fontSize: 12,
      color: "#9ca3af", cursor: "pointer", background: "none", border: "none",
      width: "100%",
    },
    error: { color: "#dc2626", fontSize: 13, marginTop: 8, textAlign: "center" },
  };

  const features = [
    "AI Macro Analyst — live headline briefing",
    "Macro Playbook — 12 event scenarios (Fed, BoJ, RBI…)",
    "India-specific impact analysis on every event",
    "Contrarian view + 48h watch indicator",
    "Unlimited AI queries",
  ];

  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={S.card}>
        <button style={S.close} onClick={onClose}>×</button>

        <div style={S.badge}>MacroRadar Pro</div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#111122", marginBottom: 6 }}>
            Unlock AI-powered macro intelligence
          </div>
          <div style={{ display: "flex", alignItems: "baseline", marginBottom: 4 }}>
            <span style={S.price}>$100</span>
            <span style={S.period}>/month</span>
          </div>
          <div style={{ fontSize: 12, color: "#9ca3af" }}>Cancel anytime from your account</div>
        </div>

        <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 16 }}>
          {features.map(f => (
            <div key={f} style={S.feature}>
              <span style={S.check}>✓</span>
              {f}
            </div>
          ))}
        </div>

        <button style={S.btn} onClick={handleSubscribe} disabled={loading}>
          {loading ? "Redirecting to Stripe..." : "Subscribe — $100/month"}
        </button>
        {error && <div style={S.error}>{error}</div>}
        <button style={S.cancel} onClick={onClose}>Maybe later</button>
      </div>
    </div>
  );
}
