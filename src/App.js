import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";
import { useAuth } from "./AuthContext";
import LoginPage from "./LoginPage";
import SubscribeModal from "./SubscribeModal";
import UserMenu from "./UserMenu";

const AV_KEY = "ZL792L85HOT616V9";

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function scoreColor(v) {
  if (v >= 65) return "#2a9d5c";
  if (v >= 48) return "#e9a825";
  return "#d64040";
}

// ─── THEME PALETTE ───────────────────────────────────────────────────────────
function makePalette(dark) {
  return dark
    ? {
        bg: "#0b0e13", surface: "#11151c", inset: "#171c25", track: "#222936",
        scrollTrack: "#11151c", scrollThumb: "#2c333f",
        border: "#242b38", borderSoft: "#1b212b", rowHi: "#161d28",
        text: "#dfe3ec", textStrong: "#f4f6fb", textMid: "#aab0c0",
        textSoft: "#8c93a5", textFaint: "#7a8194", textMuted: "#6a7180", label: "#7f8aa3",
        green: "#3fb877", red: "#e5575a", amber: "#f0b429", blue: "#8fb4ec", oil: "#e88a55",
        tintG: "#0e2419", tintR: "#2a1213", tintA: "#272006", tintN: "#1a212c",
        chipBlueBg: "#16263f", chipBlue: "#8fb4ec",
        warnText: "#f0c869", topBadgeText: "#04130a", inputAccent: "#3fb877",
      }
    : {
        bg: "#f5f6f8", surface: "#ffffff", inset: "#f5f6f8", track: "#eef0f4",
        scrollTrack: "#f0f2f6", scrollThumb: "#c8ccd8",
        border: "#dde1ea", borderSoft: "#e7e9f0", rowHi: "#f0f4ff",
        text: "#1f2030", textStrong: "#111122", textMid: "#555577",
        textSoft: "#7a7c99", textFaint: "#8a8caa", textMuted: "#9aa0b0", label: "#8a90a0",
        green: "#2a9d5c", red: "#d64040", amber: "#e9a825", blue: "#4466aa", oil: "#e87040",
        tintG: "#e8f6ee", tintR: "#fdecea", tintA: "#fff8e6", tintN: "#eef0f4",
        chipBlueBg: "#e8f0ff", chipBlue: "#4466aa",
        warnText: "#92400e", topBadgeText: "#001a0a", inputAccent: "#2a9d5c",
      };
}

function classifyImpact(title) {
  const t = title.toLowerCase();
  let eq = 0, bonds = 0, gold = 0, realty = 0, dollar = 0;
  if (t.includes("rate cut") || t.includes("dovish") || t.includes("easing")) { eq += 4; bonds += 5; gold += 2; realty += 3; dollar -= 3; }
  if (t.includes("rate hike") || t.includes("hawkish") || t.includes("tighten")) { eq -= 3; bonds -= 4; gold += 3; realty -= 3; dollar += 4; }
  if (t.includes("inflation") || t.includes("cpi")) { eq -= 2; bonds -= 3; gold += 5; dollar += 2; }
  if (t.includes("gdp") || t.includes("growth") || t.includes("strong")) { eq += 4; realty += 2; dollar += 2; }
  if (t.includes("recession") || t.includes("slowdown") || t.includes("weak")) { eq -= 4; gold += 5; bonds += 3; }
  if (t.includes("jobs") || t.includes("payroll") || t.includes("employment")) { eq += 2; dollar += 2; }
  if (t.includes("oil") || t.includes("crude") || t.includes("opec")) { gold += 2; eq -= 2; bonds -= 2; }
  if (t.includes("fpi") || t.includes("fii") || t.includes("inflow")) { eq += 4; bonds += 2; }
  if (t.includes("outflow") || t.includes("sell") || t.includes("flight")) { eq -= 4; dollar += 3; }
  if (t.includes("gold") || t.includes("safe haven")) { gold += 5; eq -= 2; }
  if (t.includes("liquidity") || t.includes("stimulus")) { eq += 3; bonds += 2; }
  const net = eq + bonds + gold;
  const sentiment = net > 3 ? "RISK-ON" : net < -3 ? "RISK-OFF" : "NEUTRAL";
  const aiWeight = Math.abs(net) > 8 ? 9 : Math.abs(net) > 4 ? 6 : 4;
  return { eq, bonds, gold, realty, dollar, sentiment, aiWeight };
}

function timeAgo(dateStr) {
  if (!dateStr) return "recent";
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 60000);
  if (diff < 1) return "just now";
  if (diff < 60) return diff + "m ago";
  if (diff < 1440) return Math.floor(diff / 60) + "h ago";
  return Math.floor(diff / 1440) + "d ago";
}

const ASSET_BASE = { equity: 52, bonds: 48, gold: 62, realty: 28, dollar: 60, crypto: 44 };
const ASSET_LABELS = { equity: "Equities", bonds: "Bonds", gold: "Gold", realty: "Real Estate", dollar: "Dollar/Cash", crypto: "Crypto" };
const ASSET_ICONS = { equity: "📈", bonds: "📄", gold: "🥇", realty: "🏢", dollar: "💵", crypto: "₿" };

const MACRO = {
  US:  { inflation: 3.1, rate: 4.75, real_yield: 1.65, gdp: 2.8, extra: "NFP: 185K" },
  IN:  { inflation: 4.8, rate: 6.25, real_yield: 1.45, gdp: 7.2, extra: "INR: 83.6" },
  JP:  { inflation: 2.7, rate: 0.1,  real_yield: -2.6, gdp: 2.1, extra: "JPY: 157" },
  CN:  { inflation: 0.3, rate: 3.45, real_yield: 3.15, gdp: 4.9, extra: "PMI: 50.4" },
  KR:  { inflation: 2.7, rate: 3.5,  real_yield: 0.8,  gdp: 2.3, extra: "Export risk" },
};

const FLAGS = { US: "🇺🇸", IN: "🇮🇳", JP: "🇯🇵", CN: "🇨🇳", KR: "🇰🇷" };

const RSS_FEEDS = [
  { url: "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms", flag: "🇮🇳", source: "Economic Times" },
  { url: "https://www.moneycontrol.com/rss/latestnews.xml", flag: "🇮🇳", source: "Moneycontrol" },
  { url: "https://feeds.reuters.com/reuters/businessNews", flag: "🌐", source: "Reuters" },
  { url: "https://www.federalreserve.gov/feeds/press_all.xml", flag: "🇺🇸", source: "US Fed" },
  { url: "https://www.rbi.org.in/Scripts/rss.aspx", flag: "🇮🇳", source: "RBI" },
];

// ─── MACRO PLAYBOOK EVENTS ───────────────────────────────────────────────────
const PLAYBOOK_EVENTS = [
  {
    id: "strong_jobs",
    label: "Strong Jobs Report",
    icon: "💼",
    category: "US",
    desc: "NFP > 200K, unemployment falls",
    color: "#e9a825",
  },
  {
    id: "fed_hike",
    label: "Fed Rate Hike",
    icon: "🏦",
    category: "US",
    desc: "FOMC raises rates 25-50bps",
    color: "#d64040",
  },
  {
    id: "fed_cut",
    label: "Fed Rate Cut",
    icon: "✂️",
    category: "US",
    desc: "FOMC cuts rates — dovish pivot",
    color: "#2a9d5c",
  },
  {
    id: "hot_cpi",
    label: "Hot CPI Surprise",
    icon: "🔥",
    category: "US",
    desc: "CPI beats — inflation re-accelerates",
    color: "#d64040",
  },
  {
    id: "boj_hike",
    label: "BoJ Rate Hike",
    icon: "🇯🇵",
    category: "JP",
    desc: "Bank of Japan raises above 0.5%",
    color: "#d64040",
  },
  {
    id: "china_stimulus",
    label: "China Stimulus",
    icon: "🇨🇳",
    category: "CN",
    desc: "PBOC cuts + fiscal package announced",
    color: "#2a9d5c",
  },
  {
    id: "rbi_cut",
    label: "RBI Rate Cut",
    icon: "🇮🇳",
    category: "IN",
    desc: "RBI cuts repo rate — India dovish",
    color: "#2a9d5c",
  },
  {
    id: "oil_spike",
    label: "Oil Price Spike",
    icon: "🛢️",
    category: "Global",
    desc: "Crude surges > $100 on supply shock",
    color: "#e9a825",
  },
  {
    id: "recession_signal",
    label: "Recession Signal",
    icon: "📉",
    category: "US",
    desc: "Yield curve inverts / GDP prints negative",
    color: "#d64040",
  },
  {
    id: "gold_breakout",
    label: "Gold Breakout",
    icon: "🥇",
    category: "Global",
    desc: "Gold breaks $2,500 — safe haven surge",
    color: "#e9a825",
  },
  {
    id: "dollar_crash",
    label: "Dollar Crash",
    icon: "💵",
    category: "US",
    desc: "DXY drops sharply — EM currencies rally",
    color: "#2a9d5c",
  },
  {
    id: "fpi_inflow",
    label: "FPI Surge India",
    icon: "💹",
    category: "IN",
    desc: "Foreign inflows spike into Indian equities",
    color: "#2a9d5c",
  },
];

export default function App() {
  const [news, setNews] = useState([]);
  const [newsStatus, setNewsStatus] = useState("Loading feeds...");
  const [prices, setPrices] = useState({ gold: null, inrusd: null, jpyusd: null, btc: null });
  const [priceStatus, setPriceStatus] = useState("Loading prices...");
  const [scores, setScores] = useState(ASSET_BASE);
  const [userWeights, setUserWeights] = useState({});
  const [country, setCountry] = useState("US");
  const [tab, setTab] = useState("news");
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [alerts, setAlerts] = useState([
    { id: 1, label: "BoJ Rate > 0.5%", active: true, triggered: false },
    { id: 2, label: "US 10Y > 5%", active: true, triggered: false },
    { id: 3, label: "VIX > 25", active: true, triggered: false },
  ]);

  // Theme (dark mode) — persisted, defaults to system preference
  const [dark, setDark] = useState(() => {
    try {
      const saved = localStorage.getItem("mr-theme");
      if (saved === "dark") return true;
      if (saved === "light") return false;
      return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch { return false; }
  });
  const c = makePalette(dark);
  useEffect(() => {
    try { localStorage.setItem("mr-theme", dark ? "dark" : "light"); } catch {}
    document.body.style.background = c.bg;
  }, [dark, c.bg]);

  // Playbook state
  const [playbookEvent, setPlaybookEvent] = useState(null);
  const [playbookResult, setPlaybookResult] = useState(null);
  const [playbookLoading, setPlaybookLoading] = useState(false);
  const [playbookHistory, setPlaybookHistory] = useState([]);

  const { user, isPro } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [showSubscribe, setShowSubscribe] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("checkout") === "success";
  });

  const fetchRSS = useCallback(async () => {
    setNewsStatus("Fetching live news...");
    const allItems = [];
    for (const feed of RSS_FEEDS) {
      try {
        const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(feed.url)}`);
        const data = await res.json();
        const xml = new DOMParser().parseFromString(data.contents, "text/xml");
        const items = [...xml.querySelectorAll("item")].slice(0, 5);
        items.forEach(item => {
          const title = item.querySelector("title")?.textContent || "";
          const link = item.querySelector("link")?.textContent || "#";
          const pubDate = item.querySelector("pubDate")?.textContent || "";
          if (title.length > 10) {
            allItems.push({ id: link, title, link, pubDate, flag: feed.flag, source: feed.source, ...classifyImpact(title) });
          }
        });
      } catch (e) { /* skip failed feed */ }
    }
    const seen = new Set();
    const unique = allItems.filter(i => { if (seen.has(i.id)) return false; seen.add(i.id); return true; })
      .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
      .slice(0, 25);
    if (unique.length > 0) {
      setNews(unique);
      setNewsStatus("Live · " + new Date().toLocaleTimeString());
    } else {
      setNewsStatus("Retrying in 2 min...");
    }
  }, []);

  const fetchPrices = useCallback(async () => {
    try {
      const [g, inr, jpy, btc] = await Promise.allSettled([
        fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=GLD&apikey=${AV_KEY}`).then(r => r.json()),
        fetch(`https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=USD&to_currency=INR&apikey=${AV_KEY}`).then(r => r.json()),
        fetch(`https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=USD&to_currency=JPY&apikey=${AV_KEY}`).then(r => r.json()),
        fetch(`https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=BTC&to_currency=USD&apikey=${AV_KEY}`).then(r => r.json()),
      ]);
      setPrices({
        gold:   g.status   === "fulfilled" ? parseFloat(g.value?.["Global Quote"]?.["05. price"] || 0) || null : null,
        inrusd: inr.status === "fulfilled" ? parseFloat(inr.value?.["Realtime Currency Exchange Rate"]?.["5. Exchange Rate"] || 0) || null : null,
        jpyusd: jpy.status === "fulfilled" ? parseFloat(jpy.value?.["Realtime Currency Exchange Rate"]?.["5. Exchange Rate"] || 0) || null : null,
        btc:    btc.status === "fulfilled" ? parseFloat(btc.value?.["Realtime Currency Exchange Rate"]?.["5. Exchange Rate"] || 0) || null : null,
      });
      setPriceStatus("Live · " + new Date().toLocaleTimeString());
    } catch (e) {
      setPriceStatus("Price error");
    }
  }, []);

  useEffect(() => {
    fetchRSS();
    fetchPrices();
    const n = setInterval(fetchRSS, 120000);
    const p = setInterval(fetchPrices, 60000);
    return () => { clearInterval(n); clearInterval(p); };
  }, [fetchRSS, fetchPrices]);

  useEffect(() => {
    if (news.length === 0) return;
    let d = { equity: 0, bonds: 0, gold: 0, realty: 0, dollar: 0, crypto: 0 };
    news.slice(0, 20).forEach(n => {
      const uw = userWeights[n.id] !== undefined ? userWeights[n.id] : n.aiWeight;
      const w = (uw / 10) * 0.6 + (n.aiWeight / 10) * 0.4;
      d.equity += (n.eq || 0) * w;
      d.bonds  += (n.bonds || 0) * w;
      d.gold   += (n.gold || 0) * w;
      d.realty += (n.realty || 0) * w;
      d.dollar += (n.dollar || 0) * w;
      d.crypto += -(n.dollar || 0) * w * 0.4;
    });
    setScores({
      equity: clamp(ASSET_BASE.equity + d.equity * 1.2, 5, 95),
      bonds:  clamp(ASSET_BASE.bonds  + d.bonds  * 1.2, 5, 95),
      gold:   clamp(ASSET_BASE.gold   + d.gold   * 1.2, 5, 95),
      realty: clamp(ASSET_BASE.realty + d.realty * 1.2, 5, 95),
      dollar: clamp(ASSET_BASE.dollar + d.dollar * 1.2, 5, 95),
      crypto: clamp(ASSET_BASE.crypto + d.crypto * 1.2, 5, 95),
    });
  }, [news, userWeights]);

  const callAI = useCallback(async () => {
    if (!user) { setShowLogin(true); return; }
    if (!isPro) { setShowSubscribe(true); return; }
    setAiLoading(true);
    setAiText("");
    const headlines = news.slice(0, 6).map(n => `${n.flag} [${n.source}] ${n.title}`).join("\n");
    const sc = Object.entries(scores).map(([k, v]) => `${k}:${Math.round(v)}`).join(", ");
    const prompt = `You are a global macro strategist. Based on these LIVE headlines:\n${headlines}\n\nAsset scores (0-100): ${sc}\n\nIn 4 sentences: (1) Where is money flowing and why? (2) Biggest risk next 30 days? (3) What should an Indian investor watch? (4) One contrarian view? Be specific.`;
    try {
      const { data, error } = await supabase.functions.invoke("anthropic-proxy", {
        body: { model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: prompt }] },
      });
      if (error) throw error;
      setAiText(data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "Analysis unavailable.");
    } catch (e) {
      setAiText("Error fetching analysis. Please try again.");
    }
    setAiLoading(false);
  }, [news, scores, user, isPro]);

  // ─── MACRO PLAYBOOK CALL ─────────────────────────────────────────────────
  const runPlaybook = useCallback(async (event) => {
    if (!user) { setShowLogin(true); return; }
    if (!isPro) { setShowSubscribe(true); return; }
    setPlaybookEvent(event);
    setPlaybookResult(null);
    setPlaybookLoading(true);

    const macroSnapshot = Object.entries(MACRO).map(([co, m]) =>
      `${co}: CPI ${m.inflation}%, Rate ${m.rate}%, Real Yield ${m.real_yield > 0 ? "+" : ""}${m.real_yield}%, GDP ${m.gdp}%`
    ).join(" | ");

    const currentScores = Object.entries(scores).map(([k, v]) => `${ASSET_LABELS[k]}: ${Math.round(v)}/100`).join(", ");

    const prompt = `You are a senior global macro strategist at a top hedge fund. A key macro event has just fired.

EVENT: "${event.label}" — ${event.desc}
CATEGORY: ${event.category}

CURRENT MACRO SNAPSHOT:
${macroSnapshot}

CURRENT ASSET SCORES (0-100, higher = more bullish):
${currentScores}

Respond ONLY in this exact JSON format (no markdown, no extra text):
{
  "headline": "one punchy 8-word max headline summarizing the market reaction",
  "regime": "RISK-ON or RISK-OFF or MIXED",
  "assets": [
    {"name": "Equities", "icon": "📈", "direction": "UP or DOWN or FLAT", "magnitude": "+2% to +5% or similar", "reason": "one sentence why"},
    {"name": "Bonds", "icon": "📄", "direction": "UP or DOWN or FLAT", "magnitude": "magnitude range", "reason": "one sentence why"},
    {"name": "Gold", "icon": "🥇", "direction": "UP or DOWN or FLAT", "magnitude": "magnitude range", "reason": "one sentence why"},
    {"name": "Dollar", "icon": "💵", "direction": "UP or DOWN or FLAT", "magnitude": "magnitude range", "reason": "one sentence why"},
    {"name": "Crypto", "icon": "₿", "direction": "UP or DOWN or FLAT", "magnitude": "magnitude range", "reason": "one sentence why"},
    {"name": "INR/USD", "icon": "🇮🇳", "direction": "UP or DOWN or FLAT", "magnitude": "magnitude range", "reason": "one sentence why"}
  ],
  "india_impact": "2 sentences specifically on India — Nifty, INR, FPI flows, RBI response",
  "watch_next": "The single most important indicator to watch in next 48 hours",
  "contrarian": "One contrarian take that most investors will miss",
  "timeframe": "immediate (hours) or short-term (days) or medium-term (weeks)"
}`;

    try {
      const { data, error } = await supabase.functions.invoke("anthropic-proxy", {
        body: { model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: prompt }] },
      });
      if (error) throw error;
      const rawText = data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "{}";
      const clean = rawText.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setPlaybookResult(parsed);
      setPlaybookHistory(prev => [{ event, result: parsed, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 5));
    } catch (e) {
      setPlaybookResult({ error: "Analysis failed. Try again." });
    }
    setPlaybookLoading(false);
  }, [scores, user, isPro]);

  const mv = MACRO[country];
  const topAsset    = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  const bottomAsset = Object.entries(scores).sort((a, b) => a[1] - b[1])[0];
  const fmt = (v, d = 2) => v ? Number(v).toFixed(d) : "—";

  const S = {
    page:    { background: c.bg, minHeight: "100vh", color: c.text, fontFamily: "system-ui, sans-serif", fontSize: 15, transition: "background .2s, color .2s" },
    header:  { background: c.surface, borderBottom: `1px solid ${c.border}`, padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50, boxShadow: dark ? "0 1px 4px rgba(0,0,0,0.4)" : "0 1px 4px rgba(0,0,0,0.06)" },
    ticker:  { background: c.surface, borderBottom: `1px solid ${c.border}`, padding: "8px 20px", display: "flex", gap: 24, overflowX: "auto", whiteSpace: "nowrap", alignItems: "center" },
    grid:    { display: "grid", gridTemplateColumns: "320px 1fr 280px", minHeight: "calc(100vh - 84px)" },
    left:    { borderRight: `1px solid ${c.border}`, display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 84px)", overflow: "hidden", background: c.surface },
    center:  { padding: "16px 20px", overflowY: "auto", maxHeight: "calc(100vh - 84px)" },
    right:   { borderLeft: `1px solid ${c.border}`, padding: "16px 14px", overflowY: "auto", maxHeight: "calc(100vh - 84px)", background: c.surface },
    card:    { background: c.surface, border: `1px solid ${c.border}`, borderRadius: 10, padding: "14px 16px", marginBottom: 10, boxShadow: dark ? "0 1px 3px rgba(0,0,0,0.3)" : "0 1px 3px rgba(0,0,0,0.04)" },
    label:   { fontSize: 17, color: c.label, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 8 },
    dot:     { width: 8, height: 8, borderRadius: "50%", background: c.green, animation: "pulse 2s infinite" },
    blink:   { width: 6, height: 6, borderRadius: "50%", background: c.green, animation: "blink 1.5s infinite" },
  };

  return (
    <div style={S.page}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        a { color: inherit; text-decoration: none; }
        a:hover { color: ${c.textStrong}; }
        input[type=range] { accent-color: ${c.inputAccent}; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: ${c.scrollTrack}; }
        ::-webkit-scrollbar-thumb { background: ${c.scrollThumb}; border-radius: 2px; }
        .pb-event-btn:hover { border-color: ${c.green} !important; color: ${c.textStrong} !important; background: ${c.tintG} !important; }
        .pb-event-btn.active { border-color: ${c.green} !important; background: ${c.tintG} !important; }
        .theme-toggle:hover { border-color: ${c.green} !important; }
      `}</style>

      {/* HEADER */}
      <div style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={S.dot} />
          <span style={{ fontWeight: 700, fontSize: 17, color: c.textStrong, letterSpacing: ".04em" }}>MACRORADAR.IN</span>
          <span style={{ fontSize: 12, color: c.textSoft }}>Global Capital Flow Intelligence · Live</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            className="theme-toggle"
            onClick={() => setDark(d => !d)}
            title={dark ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 36, height: 32, background: "none",
              border: `1px solid ${c.border}`, borderRadius: 7, cursor: "pointer",
              fontSize: 16, lineHeight: 1, color: c.text, transition: "border-color .15s",
            }}
          >
            {dark ? "☀️" : "🌙"}
          </button>
          <UserMenu onLoginClick={() => setShowLogin(true)} theme={c} />
        </div>
      </div>

      {/* TICKER */}
      <div style={S.ticker}>
        {[["GLD", prices.gold, "$", 2], ["BTC", prices.btc, "$", 0], ["INR/USD", prices.inrusd, "₹", 2], ["JPY/USD", prices.jpyusd, "¥", 1]].map(([l, v, s, d]) => (
          <span key={l} style={{ fontSize: 11 }}>
            <span style={{ color: c.textSoft }}>{l} </span>
            <span style={{ color: v ? c.text : c.textFaint, fontWeight: 600 }}>{v ? s + fmt(v, d) : "loading..."}</span>
          </span>
        ))}
        {[["Oil", "$84.2"], ["VIX", "18.4"], ["DXY", "104.2"], ["US10Y", "4.42%"]].map(([l, v]) => (
          <span key={l} style={{ fontSize: 11 }}>
            <span style={{ color: c.textSoft }}>{l} </span>
            <span style={{ color: c.textStrong, fontWeight: 600 }}>{v}</span>
          </span>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 11, color: c.textSoft }}>{priceStatus}</span>
      </div>

      {/* 3-COLUMN LAYOUT */}
      <div style={S.grid}>

        {/* LEFT — NEWS */}
        <div style={S.left}>
          <div style={{ padding: "8px 12px", borderBottom: `1px solid ${c.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={S.label}>Live News Feeds</span>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={S.blink} />
                <span style={{ fontSize: 11, color: c.textSoft }}>{newsStatus}</span>
              </div>
            </div>
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {news.length === 0 && (
              <div style={{ padding: 20, color: c.textSoft, fontSize: 17, textAlign: "center" }}>
                Loading news feeds...<br />Takes up to 30 seconds.
              </div>
            )}
            {news.map((n, i) => {
              const uw = userWeights[n.id] !== undefined ? userWeights[n.id] : n.aiWeight;
              const bull = n.sentiment === "RISK-ON";
              const bear = n.sentiment === "RISK-OFF";
              return (
                <div key={n.id + i} style={{ borderBottom: `1px solid ${c.borderSoft}`, padding: "8px 12px", background: i === 0 ? c.rowHi : "transparent" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                      <span>{n.flag}</span>
                      <span style={{ fontSize: 11, color: c.chipBlue, background: c.chipBlueBg, padding: "1px 5px", borderRadius: 3 }}>{n.source}</span>
                      <span style={{ fontSize: 11, color: c.textFaint }}>{timeAgo(n.pubDate)}</span>
                    </div>
                    <span style={{ fontSize: 11, padding: "1px 5px", borderRadius: 3, background: bull ? c.tintG : bear ? c.tintR : c.tintN, color: bull ? c.green : bear ? c.red : c.textMuted, fontWeight: 700 }}>
                      {n.sentiment}
                    </span>
                  </div>
                  <a href={n.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 17, color: c.text, lineHeight: 1.45, display: "block", marginBottom: 5 }}>
                    {n.title}
                  </a>
                  <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 5 }}>
                    {[["EQ", n.eq], ["BD", n.bonds], ["AU", n.gold], ["RE", n.realty], ["$", n.dollar]].map(([lbl, val]) =>
                      val !== 0 ? (
                        <span key={lbl} style={{ fontSize: 11, padding: "1px 4px", borderRadius: 2, background: val > 0 ? c.tintG : c.tintR, color: val > 0 ? c.green : c.red }}>
                          {lbl} {val > 0 ? "+" : ""}{val}
                        </span>
                      ) : null
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 11, color: c.textFaint, minWidth: 55 }}>Your weight</span>
                    <input type="range" min={0} max={10} value={uw} onChange={e => setUserWeights(p => ({ ...p, [n.id]: parseInt(e.target.value) }))} style={{ flex: 1, height: 2 }} />
                    <span style={{ fontSize: 12, color: c.green, fontWeight: 700, minWidth: 12 }}>{uw}</span>
                    <span style={{ fontSize: 11, color: c.textFaint }}>AI:{n.aiWeight}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CENTER */}
        <div style={S.center}>
          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: `1px solid ${c.border}`, marginBottom: 12 }}>
            {[["news", "Overview"], ["playbook", "⚡ Playbook"], ["yield", "Real Yield"], ["alerts", "⚑ Alerts"], ["flows", "Flow Map"]].map(([id, lbl]) => (
              <button key={id} onClick={() => setTab(id)} style={{ padding: "5px 14px", fontSize: 17, background: "transparent", border: "none", borderBottom: tab === id ? `2px solid ${c.green}` : "2px solid transparent", color: tab === id ? c.textStrong : c.textMuted, cursor: "pointer", fontWeight: tab === id ? 700 : 400 }}>
                {lbl}
              </button>
            ))}
          </div>

          {/* ─── PLAYBOOK TAB ─────────────────────────────────────────────── */}
          {tab === "playbook" && (
            <div>
              {/* Header */}
              <div style={{ ...S.card, marginBottom: 12 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 22 }}>⚡</span>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: c.textStrong, marginBottom: 3 }}>Macro Playbook — AI Event Intelligence</div>
                    <div style={{ fontSize: 17, color: c.textMid, lineHeight: 1.6 }}>
                      Select a macro event below. Claude reads the <strong style={{ color: c.text }}>current macro snapshot</strong> (rates, CPI, GDP, real yields) and tells you exactly how each asset class will react — with India-specific impact and contrarian view.
                    </div>
                  </div>
                </div>
              </div>

              {/* Pro gate banner */}
              {!isPro && (
                <div style={{ ...S.card, border: `1px solid ${c.amber}`, background: c.tintA, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 13, color: c.warnText }}>
                    🔒 <strong>Pro feature.</strong> Subscribe to fire events and get AI analysis.
                  </div>
                  <button
                    onClick={() => user ? setShowSubscribe(true) : setShowLogin(true)}
                    style={{ padding: "5px 14px", background: c.green, color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                  >
                    {user ? "Upgrade — $100/mo" : "Log in to subscribe"}
                  </button>
                </div>
              )}

              {/* Event Grid */}
              <div style={S.label}>Select a macro event to fire</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginBottom: 16 }}>
                {PLAYBOOK_EVENTS.map(ev => (
                  <button
                    key={ev.id}
                    className={`pb-event-btn${playbookEvent?.id === ev.id ? " active" : ""}`}
                    onClick={() => runPlaybook(ev)}
                    disabled={playbookLoading}
                    style={{
                      background: playbookEvent?.id === ev.id ? c.tintG : c.surface,
                      border: `1px solid ${playbookEvent?.id === ev.id ? c.green : c.border}`,
                      borderRadius: 7,
                      padding: "8px 10px",
                      textAlign: "left",
                      cursor: playbookLoading ? "not-allowed" : "pointer",
                      transition: "all .15s",
                      opacity: playbookLoading && playbookEvent?.id !== ev.id ? 0.5 : 1,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontSize: 16 }}>{ev.icon}</span>
                      <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 3, background: c.inset, color: ev.color, fontWeight: 700 }}>{ev.category}</span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: c.text, marginBottom: 2, lineHeight: 1.3 }}>{ev.label}</div>
                    <div style={{ fontSize: 11, color: c.textSoft, lineHeight: 1.3 }}>{ev.desc}</div>
                  </button>
                ))}
              </div>

              {/* Loading */}
              {playbookLoading && (
                <div style={{ ...S.card, textAlign: "center", padding: "28px 12px" }}>
                  <div style={{ width: 20, height: 20, border: `2px solid ${c.border}`, borderTopColor: c.green, borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto 10px" }} />
                  <div style={{ fontSize: 17, color: c.textMid }}>Claude is reading the current macro environment and reasoning through market impacts...</div>
                </div>
              )}

              {/* Result */}
              {playbookResult && !playbookLoading && !playbookResult.error && (
                <div style={{ animation: "fadeIn .3s ease" }}>
                  {/* Headline */}
                  <div style={{ ...S.card, border: `1px solid ${playbookResult.regime === "RISK-ON" ? c.green : playbookResult.regime === "RISK-OFF" ? c.red : c.amber}`, marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontSize: 11, color: c.textSoft, marginBottom: 4 }}>AI MACRO VERDICT · {playbookEvent?.label?.toUpperCase()}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: c.textStrong, lineHeight: 1.3 }}>{playbookResult.headline}</div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                        <span style={{
                          fontSize: 12, fontWeight: 700, padding: "3px 8px", borderRadius: 4,
                          background: playbookResult.regime === "RISK-ON" ? c.tintG : playbookResult.regime === "RISK-OFF" ? c.tintR : c.tintA,
                          color: playbookResult.regime === "RISK-ON" ? c.green : playbookResult.regime === "RISK-OFF" ? c.red : c.amber
                        }}>{playbookResult.regime}</span>
                        <span style={{ fontSize: 11, color: c.textFaint }}>{playbookResult.timeframe}</span>
                      </div>
                    </div>
                  </div>

                  {/* Asset Grid */}
                  <div style={S.label}>Asset class reactions</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginBottom: 10 }}>
                    {(playbookResult.assets || []).map(a => (
                      <div key={a.name} style={{ ...S.card, marginBottom: 0, padding: "8px 10px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <span style={{ fontSize: 14 }}>{a.icon}</span>
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: "1px 5px", borderRadius: 3,
                            background: a.direction === "UP" ? c.tintG : a.direction === "DOWN" ? c.tintR : c.tintN,
                            color: a.direction === "UP" ? c.green : a.direction === "DOWN" ? c.red : c.textMuted
                          }}>
                            {a.direction === "UP" ? "▲" : a.direction === "DOWN" ? "▼" : "—"} {a.magnitude}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: c.text, marginBottom: 3 }}>{a.name}</div>
                        <div style={{ fontSize: 11, color: c.textSoft, lineHeight: 1.4 }}>{a.reason}</div>
                      </div>
                    ))}
                  </div>

                  {/* India Impact */}
                  <div style={{ ...S.card, marginBottom: 8 }}>
                    <div style={S.label}>🇮🇳 India-specific impact</div>
                    <div style={{ fontSize: 17, color: c.text, lineHeight: 1.7 }}>{playbookResult.india_impact}</div>
                  </div>

                  {/* Watch + Contrarian */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div style={{ ...S.card, marginBottom: 0 }}>
                      <div style={S.label}>👁 Watch next 48h</div>
                      <div style={{ fontSize: 17, color: c.amber, lineHeight: 1.5 }}>{playbookResult.watch_next}</div>
                    </div>
                    <div style={{ ...S.card, marginBottom: 0 }}>
                      <div style={S.label}>🔄 Contrarian take</div>
                      <div style={{ fontSize: 17, color: c.text, lineHeight: 1.5 }}>{playbookResult.contrarian}</div>
                    </div>
                  </div>
                </div>
              )}

              {playbookResult?.error && (
                <div style={{ ...S.card, color: c.red, fontSize: 11 }}>{playbookResult.error}</div>
              )}

              {/* History */}
              {playbookHistory.length > 1 && (
                <div style={{ marginTop: 16 }}>
                  <div style={S.label}>Recent Playbook runs</div>
                  {playbookHistory.slice(1).map((h, i) => (
                    <div key={i} style={{ ...S.card, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", cursor: "pointer" }}
                      onClick={() => { setPlaybookEvent(h.event); setPlaybookResult(h.result); }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ fontSize: 14 }}>{h.event.icon}</span>
                        <div>
                          <div style={{ fontSize: 12, color: c.text }}>{h.event.label}</div>
                          <div style={{ fontSize: 11, color: c.textFaint }}>{h.time}</div>
                        </div>
                      </div>
                      <span style={{
                        fontSize: 11, padding: "1px 6px", borderRadius: 3, fontWeight: 700,
                        background: h.result.regime === "RISK-ON" ? c.tintG : h.result.regime === "RISK-OFF" ? c.tintR : c.tintA,
                        color: h.result.regime === "RISK-ON" ? c.green : h.result.regime === "RISK-OFF" ? c.red : c.amber
                      }}>{h.result.regime}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "news" && (
            <>
              {/* Country Tabs */}
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                {Object.keys(MACRO).map(co => (
                  <button key={co} onClick={() => setCountry(co)} style={{ padding: "3px 10px", borderRadius: 5, border: "1px solid", borderColor: country === co ? c.green : c.border, background: country === co ? c.tintG : c.surface, color: country === co ? c.green : c.textMuted, fontSize: 17, cursor: "pointer" }}>
                    {FLAGS[co]} {co}
                  </button>
                ))}
              </div>

              {/* Country Macro */}
              <div style={{ ...S.card, marginBottom: 12 }}>
                <div style={S.label}>{FLAGS[country]} {country} · Macro Variables</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
                  {[
                    ["CPI", mv.inflation + "%", mv.inflation > 5 ? c.red : mv.inflation < 2 ? c.blue : c.amber],
                    ["Policy Rate", mv.rate + "%", c.text],
                    ["Real Yield", (mv.real_yield > 0 ? "+" : "") + mv.real_yield.toFixed(2) + "%", mv.real_yield < 0 ? c.red : mv.real_yield > 2 ? c.green : c.amber],
                    ["GDP", mv.gdp + "%", mv.gdp > 5 ? c.green : mv.gdp > 2 ? c.amber : c.red],
                    ["Extra", mv.extra, c.text],
                    ["Oil", "$84.2", c.oil],
                    ["Net Flow", country === "US" ? "Receiving" : country === "JP" ? "Sending" : "Mixed", country === "US" ? c.green : c.amber],
                    ["Trend", country === "US" ? "Bullish" : country === "IN" ? "Cautious" : "Neutral", country === "US" ? c.green : c.amber],
                  ].map(([lbl, val, col]) => (
                    <div key={lbl} style={{ background: c.inset, borderRadius: 5, padding: "7px 8px" }}>
                      <div style={{ fontSize: 11, color: c.textFaint, marginBottom: 2 }}>{lbl}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: col }}>{val}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 8, padding: "6px 8px", background: c.inset, borderRadius: 5, fontSize: 17, color: c.textMid, lineHeight: 1.6 }}>
                  <strong style={{ color: c.text }}>Real Yield</strong> = {mv.rate}% − {mv.inflation}% = <strong style={{ color: mv.real_yield < 0 ? c.red : mv.real_yield > 2 ? c.green : c.amber }}>{(mv.real_yield > 0 ? "+" : "") + mv.real_yield.toFixed(2)}%</strong>
                  <span style={{ marginLeft: 8 }}>{mv.real_yield < 0 ? "→ Negative: money flees to gold/equities" : mv.real_yield > 2 ? "→ High: bonds attractive" : "→ Mild: balanced"}</span>
                </div>
              </div>

              {/* Asset Scores */}
              <div style={S.label}>Where is money flowing? · News-weighted scores</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 12 }}>
                {Object.entries(scores).map(([asset, score]) => {
                  const sc = Math.round(score);
                  const isTop = topAsset[0] === asset;
                  const col = scoreColor(sc);
                  const lbl = sc >= 65 ? "BULLISH" : sc >= 48 ? "NEUTRAL" : "BEARISH";
                  return (
                    <div key={asset} style={{ ...S.card, marginBottom: 0, border: `1px solid ${isTop ? c.green : c.border}`, position: "relative" }}>
                      {isTop && <div style={{ position: "absolute", top: -1, right: 6, fontSize: 10, background: c.green, color: c.topBadgeText, padding: "1px 5px", borderRadius: "0 0 4px 4px", fontWeight: 700 }}>TOP</div>}
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 16 }}>{ASSET_ICONS[asset]}</span>
                        <span style={{ fontSize: 11, padding: "2px 5px", borderRadius: 3, color: col, fontWeight: 700 }}>{lbl}</span>
                      </div>
                      <div style={{ fontSize: 12, color: c.textMid, marginBottom: 2 }}>{ASSET_LABELS[asset]}</div>
                      <div style={{ fontSize: 26, fontWeight: 700, color: col }}>{sc}</div>
                      <div style={{ height: 3, background: c.track, borderRadius: 2, overflow: "hidden", marginTop: 4 }}>
                        <div style={{ height: "100%", width: sc + "%", background: col, transition: "width .6s" }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* AI Analysis */}
              <div style={{ ...S.card }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                  <span style={S.label}>AI Macro Analyst · Live Headlines</span>
                  <button onClick={callAI} style={{ fontSize: 12, padding: "3px 10px", background: isPro ? c.tintG : c.inset, border: `1px solid ${isPro ? c.green : c.border}`, borderRadius: 5, color: isPro ? c.green : c.textMuted, cursor: "pointer" }}>
                    {aiLoading ? "Analyzing..." : !user ? "🔒 Log in to analyze" : !isPro ? "🔒 Pro feature" : "Analyze now ↗"}
                  </button>
                </div>
                {aiText
                  ? <div style={{ fontSize: 17, color: c.text, lineHeight: 1.7 }}>{aiText}</div>
                  : <div style={{ fontSize: 17, color: c.textFaint, fontStyle: "italic" }}>
                      {!user
                        ? <>🔒 <strong>Log in</strong> and subscribe to get a live AI macro brief on today's headlines.</>
                        : !isPro
                        ? <>🔒 <strong>Pro feature</strong> — subscribe at $100/month to unlock AI analysis.</>
                        : <>Click "Analyze now" — Claude reads today's actual headlines and gives you a macro brief.</>
                      }
                    </div>
                }
              </div>
            </>
          )}

          {tab === "yield" && (
            <>
              <div style={S.label}>Real Yield · All Countries</div>
              <div style={{ ...S.card, fontSize: 17, color: c.textMid, lineHeight: 1.7, marginBottom: 12 }}>
                <strong style={{ color: c.text }}>Real Yield = Nominal Rate − CPI Inflation.</strong> Negative = money leaves bonds for gold/equities. High positive = bonds attract capital.
              </div>
              {Object.entries(MACRO).map(([co, m]) => {
                const ry = m.real_yield; const neg = ry < 0; const w = Math.min(Math.abs(ry) / 6 * 100, 85);
                return (
                  <div key={co} style={{ ...S.card }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 12 }}>{FLAGS[co]} {co}</span>
                      <div style={{ display: "flex", gap: 10, fontSize: 17, color: c.textSoft }}>
                        <span>Rate: <strong style={{ color: c.text }}>{m.rate}%</strong></span>
                        <span>CPI: <strong style={{ color: c.text }}>{m.inflation}%</strong></span>
                        <strong style={{ color: neg ? c.red : ry > 2 ? c.green : c.amber }}>Real: {ry > 0 ? "+" : ""}{ry.toFixed(2)}%</strong>
                      </div>
                    </div>
                    <div style={{ height: 6, background: c.track, borderRadius: 3, overflow: "hidden", marginBottom: 5 }}>
                      <div style={{ float: neg ? "right" : "left", width: w + "%", height: "100%", background: neg ? c.red : ry > 2 ? c.green : c.amber, borderRadius: 3 }} />
                    </div>
                    <div style={{ fontSize: 12, color: c.textMid }}>
                      {neg ? "↳ Negative → carry trade origin. Capital flees to gold/equities." : ry > 2 ? "↳ High → bonds attractive, currency strong." : "↳ Mild positive — balanced."}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {tab === "alerts" && (
            <>
              <div style={S.label}>Threshold Alerts · Scenario Impact</div>
              <div style={{ ...S.card, fontSize: 17, color: c.textMid, marginBottom: 12 }}>
                Live: <strong style={{ color: c.text }}>BoJ 0.1%</strong> · <strong style={{ color: c.text }}>US10Y 4.42%</strong> · <strong style={{ color: c.text }}>VIX 18.4</strong> · <strong style={{ color: c.text }}>Gold $2,340</strong>
              </div>
              {alerts.map(a => (
                <div key={a.id} style={{ ...S.card, opacity: a.active ? 1 : 0.5 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 17, color: c.text, fontWeight: 600 }}>{a.label}</span>
                    <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 12, color: c.textSoft }}>
                      <input type="checkbox" checked={a.active} onChange={e => setAlerts(p => p.map(x => x.id === a.id ? { ...x, active: e.target.checked } : x))} />
                      {a.active ? "On" : "Off"}
                    </label>
                  </div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {(a.id === 1
                      ? [["Equities", -8], ["Bonds", +4], ["Gold", +6], ["Dollar", -4]]
                      : a.id === 2
                      ? [["Equities", -5], ["Bonds", -8], ["Gold", +5], ["Dollar", +4]]
                      : [["Equities", -6], ["Bonds", +3], ["Gold", +7], ["Cash", +4]]
                    ).map(([asset, delta]) => (
                      <span key={asset} style={{ fontSize: 17, padding: "2px 8px", borderRadius: 4, background: delta > 0 ? c.tintG : c.tintR, color: delta > 0 ? c.green : c.red }}>
                        {asset} {delta > 0 ? "+" : ""}{delta}%
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}

          {tab === "flows" && (
            <>
              <div style={S.label}>Global Capital Flow Map</div>
              {[
                { from: "🇯🇵 Japan", to: "🇺🇸 USA", size: "$2.8T", col: c.green, reason: "Carry trade — borrow JPY 0.1%, buy UST 4.4%", strength: 92 },
                { from: "🇸🇦 Gulf", to: "🇺🇸 USA", size: "~$600B", col: c.green, reason: "Petrodollar recycling into US equities and T-bills", strength: 75 },
                { from: "🇪🇺 Europe", to: "🇺🇸 USA", size: "~$400B", col: c.amber, reason: "ECB cutting — EUR capital seeking higher US returns", strength: 58 },
                { from: "🇮🇳 India", to: "🇺🇸 USA", size: "$4.2B", col: c.red, reason: "FPI outflow — USD yield differential too wide", strength: 42 },
                { from: "🇨🇳 China", to: "🥇 Gold", size: "Divesting", col: c.amber, reason: "PBOC buying gold, reducing US Treasury exposure", strength: 55 },
              ].map((f, i) => (
                <div key={i} style={{ ...S.card }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: c.textMid, minWidth: 80 }}>{f.from}</span>
                    <div style={{ flex: 1, height: 2, background: c.track, borderRadius: 1, position: "relative" }}>
                      <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: f.strength + "%", background: f.col, transition: "width .5s" }} />
                      <span style={{ position: "absolute", right: -8, top: -7, fontSize: 12, color: f.col }}>→</span>
                    </div>
                    <span style={{ fontSize: 12, color: c.textStrong, fontWeight: 600, minWidth: 55 }}>{f.to}</span>
                    <span style={{ fontSize: 12, color: f.col, fontWeight: 700, minWidth: 50, textAlign: "right" }}>{f.size}</span>
                  </div>
                  <div style={{ fontSize: 12, color: c.textSoft }}>{f.reason}</div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* RIGHT — VERDICT */}
        <div style={S.right}>
          <div style={S.label}>Live Verdict</div>
          <div style={{ background: c.tintG, border: `1px solid ${c.green}`, borderRadius: 8, padding: 12, marginBottom: 8, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: c.green, marginBottom: 3 }}>MONEY FLOWING TO</div>
            <div style={{ fontSize: 26, marginBottom: 2 }}>{ASSET_ICONS[topAsset[0]]}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: c.green }}>{ASSET_LABELS[topAsset[0]]}</div>
            <div style={{ fontSize: 12, color: c.textSoft, marginTop: 3 }}>Score: {Math.round(topAsset[1])}/100</div>
          </div>
          <div style={{ background: c.tintR, border: `1px solid ${c.red}`, borderRadius: 8, padding: 12, marginBottom: 12, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: c.red, marginBottom: 3 }}>CAPITAL LEAVING</div>
            <div style={{ fontSize: 26, marginBottom: 2 }}>{ASSET_ICONS[bottomAsset[0]]}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: c.red }}>{ASSET_LABELS[bottomAsset[0]]}</div>
            <div style={{ fontSize: 12, color: c.textSoft, marginTop: 3 }}>Score: {Math.round(bottomAsset[1])}/100</div>
          </div>

          <div style={S.label}>By Country</div>
          {[
            { c: "🇺🇸", n: "USA", flow: "Receiving", col: c.green, detail: "Equities + T-bills" },
            { c: "🇯🇵", n: "Japan", flow: "Sending", col: c.amber, detail: "Carry → USD" },
            { c: "🇮🇳", n: "India", flow: "Outflow", col: c.red, detail: "FPI leaving" },
            { c: "🇨🇳", n: "China", flow: "Diverging", col: c.amber, detail: "UST → Gold" },
            { c: "🇰🇷", n: "Korea", flow: "Neutral", col: c.textMuted, detail: "Export risk" },
          ].map(f => (
            <div key={f.c} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${c.borderSoft}` }}>
              <div style={{ fontSize: 11 }}><span style={{ marginRight: 5 }}>{f.c}</span><span style={{ color: c.textMid }}>{f.n}</span></div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: f.col }}>{f.flow}</div>
                <div style={{ fontSize: 11, color: c.textFaint }}>{f.detail}</div>
              </div>
            </div>
          ))}

          <div style={{ marginTop: 12 }}><div style={S.label}>Risk Radar</div></div>
          {[
            ["BoJ hike", "HIGH", c.red, "Carry unwind"],
            ["US inflation", "MED", c.amber, "Fed hawkish"],
            ["Rupee", "MED", c.amber, "INR at 83.6"],
            ["China PMI", "MED", c.amber, "EM drag"],
            ["Dollar", "LOW", c.green, "DXY softening"],
          ].map(([r, lv, col, sub]) => (
            <div key={r} style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
              <div>
                <div style={{ fontSize: 12, color: c.textMid }}>{r}</div>
                <div style={{ fontSize: 11, color: c.textFaint }}>{sub}</div>
              </div>
              <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 3, background: col + "22", color: col, fontWeight: 700 }}>{lv}</span>
            </div>
          ))}

          {/* Playbook shortcut in sidebar */}
          {playbookResult && !playbookResult.error && (
            <div style={{ marginTop: 12, padding: 8, background: c.surface, border: `1px solid ${c.border}`, borderRadius: 6 }}>
              <div style={S.label}>Last Playbook · {playbookEvent?.label}</div>
              <div style={{ fontSize: 12, color: c.text, marginBottom: 4 }}>{playbookResult.headline}</div>
              <button onClick={() => setTab("playbook")} style={{ fontSize: 11, padding: "2px 8px", background: c.tintG, border: `1px solid ${c.green}`, borderRadius: 4, color: c.green, cursor: "pointer" }}>
                View full analysis ↗
              </button>
            </div>
          )}

          <div style={{ marginTop: 10, padding: 8, background: c.surface, borderRadius: 6, fontSize: 12, color: c.textFaint, lineHeight: 1.6 }}>
            <strong style={{ color: c.text }}>Watch: </strong>
            BoJ Jul 31. Signal above 0.25% = carry unwind. RBI Aug = rate cut signal for India.
          </div>
        </div>
      </div>

      {/* Modals */}
      {showLogin && <LoginPage onClose={() => setShowLogin(false)} />}
      {showSubscribe && <SubscribeModal onClose={() => setShowSubscribe(false)} />}

      {/* Checkout success toast */}
      {checkoutSuccess && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, background: c.green, color: "#fff",
          padding: "12px 20px", borderRadius: 10, fontSize: 14, fontWeight: 600,
          boxShadow: "0 4px 16px rgba(0,0,0,0.18)", zIndex: 300, display: "flex", gap: 10, alignItems: "center",
        }}>
          <span>✓</span>
          <span>Subscription activating… AI features will unlock in a moment.</span>
          <button onClick={() => setCheckoutSuccess(false)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 16, marginLeft: 4 }}>×</button>
        </div>
      )}
    </div>
  );
}
