import { useState, useRef, useEffect } from "react";
import { useAuth } from "./AuthContext";

export default function UserMenu({ onLoginClick }) {
  const { user, isPro, signOut, openPortal } = useAuth();
  const [open, setOpen] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!user) {
    return (
      <button
        onClick={onLoginClick}
        style={{
          padding: "5px 16px", fontSize: 13, fontWeight: 600,
          background: "#2a9d5c", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer",
        }}
      >
        Log in
      </button>
    );
  }

  const handlePortal = async () => {
    setPortalLoading(true);
    try { await openPortal(); } catch { setPortalLoading(false); }
  };

  const S = {
    wrap: { position: "relative" },
    trigger: {
      display: "flex", alignItems: "center", gap: 7, cursor: "pointer",
      background: "none", border: "1px solid #e5e7eb", borderRadius: 7,
      padding: "5px 12px", fontSize: 13, color: "#374151",
    },
    avatar: {
      width: 26, height: 26, borderRadius: "50%", background: "#2a9d5c",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontWeight: 700, fontSize: 12,
    },
    dropdown: {
      position: "absolute", right: 0, top: "calc(100% + 6px)",
      background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8,
      boxShadow: "0 4px 16px rgba(0,0,0,0.10)", width: 220, zIndex: 100,
      overflow: "hidden",
    },
    head: { padding: "12px 14px", borderBottom: "1px solid #f3f4f6" },
    item: {
      display: "block", width: "100%", textAlign: "left", padding: "10px 14px",
      fontSize: 13, color: "#374151", background: "none", border: "none",
      cursor: "pointer", borderBottom: "1px solid #f9fafb",
    },
  };

  const initial = (user.email || "U")[0].toUpperCase();

  return (
    <div style={S.wrap} ref={ref}>
      <button style={S.trigger} onClick={() => setOpen(o => !o)}>
        <div style={S.avatar}>{initial}</div>
        <span>{user.email?.split("@")[0]}</span>
        <span style={{ fontSize: 11, color: isPro ? "#2a9d5c" : "#9ca3af", fontWeight: 700 }}>
          {isPro ? "PRO" : "FREE"}
        </span>
        <span style={{ fontSize: 10, color: "#9ca3af" }}>▾</span>
      </button>

      {open && (
        <div style={S.dropdown}>
          <div style={S.head}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#111122" }}>{user.email}</div>
            <div style={{ fontSize: 11, color: isPro ? "#2a9d5c" : "#9ca3af", marginTop: 2 }}>
              {isPro ? "✓ MacroRadar Pro — active" : "Free plan"}
            </div>
          </div>
          {isPro && (
            <button style={S.item} onClick={() => { setOpen(false); handlePortal(); }}>
              {portalLoading ? "Loading..." : "Manage subscription ↗"}
            </button>
          )}
          <button style={{ ...S.item, color: "#dc2626", borderBottom: "none" }}
            onClick={() => { setOpen(false); signOut(); }}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
