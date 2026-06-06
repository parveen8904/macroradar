import { useState, useEffect, useCallback } from "react";

const AV_KEY = "ZL792L85HOT616V9";

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function scoreColor(v) {
  if (v >= 65) return "#2a9d5c";
  if (v >= 48) return "#e9a825";
  return "#d64040";
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

  // Playbook state
  const [playbookEvent, setPlaybookEvent] = useState(null);
  const [playbookResult, setPlaybookResult] = useState(null);
  const [playbookLoading, setPlaybookLoading] = useState(false);
  const [playbookHistory, setPlaybookHistory] = useState([]);

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
    setAiLoading(true);
    setAiText("");
    const headlines = news.slice(0, 6).map(n => `${n.flag} [${n.source}] ${n.title}`).join("\n");
    const sc = Object.entries(scores).map(([k, v]) => `${k}:${Math.round(v)}`).join(", ");
    const prompt = `You are a global macro strategist. Based on these LIVE headlines:\n${headlines}\n\nAsset scores (0-100): ${sc}\n\nIn 4 sentences: (1) Where is money flowing and why? (2) Biggest risk next 30 days? (3) What should an Indian investor watch? (4) One contrarian view? Be specific.`;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
      });
      const data = await res.json();
      setAiText(data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "Analysis unavailable.");
    } catch (e) {
      setAiText("Error fetching analysis. Please try again.");
    }
    setAiLoading(false);
  }, [news, scores]);

  // ─── MACRO PLAYBOOK CALL ─────────────────────────────────────────────────
  const runPlaybook = useCallback(async (event) => {
    setPlaybookEvent(event);
    setPlaybookResult(null);
    setPlaybookLoading(true);

    const macroSnapshot = Object.entries(MACRO).map(([c, m]) =>
      `${c}: CPI ${m.inflation}%, Rate ${m.rate}%, Real Yield ${m.real_yield > 0 ? "+" : ""}${m.real_yield}%, GDP ${m.gdp}%`
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
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }]
        }),
      });
      const data = await res.json();
      const rawText = data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "{}";
      const clean = rawText.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setPlaybookResult(parsed);
      setPlaybookHistory(prev => [{ event, result: parsed, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 5));
    } catch (e) {
      setPlaybookResult({ error: "Analysis failed. Try again." });
    }
    setPlaybookLoading(false);
  }, [scores]);

  const mv = MACRO[country];
  const topAsset    = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  const bottomAsset = Object.entries(scores).sort((a, b) => a[1] - b[1])[0];
  const fmt = (v, d = 2) => v ? Number(v).toFixed(d) : "—";

  const S = {
    page:    { background: "#f5f6f8", minHeight: "100vh", color: "#1a1a2e", fontFamily: "system-ui, sans-serif", fontSize: 15 },
    header:  { background: "#ffffff", borderBottom: "1px solid #dde1ea", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" },
    ticker:  { background: "#ffffff", borderBottom: "1px solid #dde1ea", padding: "8px 20px", display: "flex", gap: 24, overflowX: "auto", whiteSpace: "nowrap", alignItems: "center" },
    grid:    { display: "grid", gridTemplateColumns: "320px 1fr 280px", minHeight: "calc(100vh - 84px)" },
    left:    { borderRight: "1px solid #dde1ea", display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 84px)", overflow: "hidden", background: "#ffffff" },
    center:  { padding: "16px 20px", overflowY: "auto", maxHeight: "calc(100vh - 84px)" },
    right:   { borderLeft: "1px solid #dde1ea", padding: "16px 14px", overflowY: "auto", maxHeight: "calc(100vh - 84px)", background: "#ffffff" },
    card:    { background: "#ffffff", border: "1px solid #dde1ea", borderRadius: 10, padding: "14px 16px", marginBottom: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" },
    label:   { fontSize: 17, color: "#8a90a0", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 8 },
    dot:     { width: 8, height: 8, borderRadius: "50%", background: "#2a9d5c", animation: "pulse 2s infinite" },
    blink:   { width: 6, height: 6, borderRadius: "50%", background: "#2a9d5c", animation: "blink 1.5s infinite" },
  };

  return (
    <div style={S.page}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        a { color: inherit; text-decoration: none; }
        a:hover { color: #111122; }
        input[type=range] { accent-color: #2a9d5c; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #f0f2f6; }
        ::-webkit-scrollbar-thumb { background: #c8ccd8; border-radius: 2px; }
        .pb-event-btn:hover { border-color: #2a9d5c !important; color: #111122 !important; background: #eafaf2 !important; }
        .pb-event-btn.active { border-color: #2a9d5c !important; background: #eafaf2 !important; }
      `}</style>

      {/* HEADER */}
      <div style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={S.dot} />
          <span style={{ fontWeight: 700, fontSize: 17, color: "#111122", letterSpacing: ".04em", color: "#111122" }}>MACRORADAR.IN</span>
          <span style={{ fontSize: 12, color: "#7a7c99" }}>Global Capital Flow Intelligence · Live</span>
        </div>
        <span style={{ fontSize: 12, color: "#7a7c99" }}>June 06, 2026</span>
      </div>

      {/* TICKER */}
      <div style={S.ticker}>
        {[["GLD", prices.gold, "$", 2], ["BTC", prices.btc, "$", 0], ["INR/USD", prices.inrusd, "₹", 2], ["JPY/USD", prices.jpyusd, "¥", 1]].map(([l, v, s, d]) => (
          <span key={l} style={{ fontSize: 11 }}>
            <span style={{ color: "#7a7c99" }}>{l} </span>
            <span style={{ color: v ? "#e6e6e8" : "#3a4050", fontWeight: 600 }}>{v ? s + fmt(v, d) : "loading..."}</span>
          </span>
        ))}
        {[["Oil", "$84.2"], ["VIX", "18.4"], ["DXY", "104.2"], ["US10Y", "4.42%"]].map(([l, v]) => (
          <span key={l} style={{ fontSize: 11 }}>
            <span style={{ color: "#7a7c99" }}>{l} </span>
            <span style={{ color: "#111122", fontWeight: 600 }}>{v}</span>
          </span>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#7a7c99" }}>{priceStatus}</span>
      </div>

      {/* 3-COLUMN LAYOUT */}
      <div style={S.grid}>

        {/* LEFT — NEWS */}
        <div style={S.left}>
          <div style={{ padding: "8px 12px", borderBottom: "1px solid #1c2028" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={S.label}>Live News Feeds</span>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={S.blink} />
                <span style={{ fontSize: 11, color: "#7a7c99" }}>{newsStatus}</span>
              </div>
            </div>
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {news.length === 0 && (
              <div style={{ padding: 20, color: "#7a7c99", fontSize: 17, textAlign: "center" }}>
                Loading news feeds...<br />Takes up to 30 seconds.
              </div>
            )}
            {news.map((n, i) => {
              const uw = userWeights[n.id] !== undefined ? userWeights[n.id] : n.aiWeight;
              const bull = n.sentiment === "RISK-ON";
              const bear = n.sentiment === "RISK-OFF";
              return (
                <div key={n.id + i} style={{ borderBottom: "1px solid #121518", padding: "8px 12px", background: i === 0 ? "#10141a" : "transparent" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                      <span>{n.flag}</span>
                      <span style={{ fontSize: 11, color: "#4466aa", background: "#e8f0ff", padding: "1px 5px", borderRadius: 3 }}>{n.source}</span>
                      <span style={{ fontSize: 11, color: "#8a8caa" }}>{timeAgo(n.pubDate)}</span>
                    </div>
                    <span style={{ fontSize: 11, padding: "1px 5px", borderRadius: 3, background: bull ? "#0a1a10" : bear ? "#1a0808" : "#121518", color: bull ? "#2a9d5c" : bear ? "#d64040" : "#3a4050", fontWeight: 700 }}>
                      {n.sentiment}
                    </span>
                  </div>
                  <a href={n.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 17, color: "#2a2a3e", lineHeight: 1.45, display: "block", marginBottom: 5 }}>
                    {n.title}
                  </a>
                  <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 5 }}>
                    {[["EQ", n.eq], ["BD", n.bonds], ["AU", n.gold], ["RE", n.realty], ["$", n.dollar]].map(([lbl, val]) =>
                      val !== 0 ? (
                        <span key={lbl} style={{ fontSize: 11, padding: "1px 4px", borderRadius: 2, background: val > 0 ? "#091408" : "#160606", color: val > 0 ? "#2a9d5c" : "#d64040" }}>
                          {lbl} {val > 0 ? "+" : ""}{val}
                        </span>
                      ) : null
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 11, color: "#8a8caa", minWidth: 55 }}>Your weight</span>
                    <input type="range" min={0} max={10} value={uw} onChange={e => setUserWeights(p => ({ ...p, [n.id]: parseInt(e.target.value) }))} style={{ flex: 1, height: 2 }} />
                    <span style={{ fontSize: 12, color: "#2a9d5c", fontWeight: 700, minWidth: 12 }}>{uw}</span>
                    <span style={{ fontSize: 11, color: "#8a8caa" }}>AI:{n.aiWeight}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CENTER */}
        <div style={S.center}>
          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid #1c2028", marginBottom: 12 }}>
            {[["news", "Overview"], ["playbook", "⚡ Playbook"], ["yield", "Real Yield"], ["alerts", "⚑ Alerts"], ["flows", "Flow Map"]].map(([id, lbl]) => (
              <button key={id} onClick={() => setTab(id)} style={{ padding: "5px 14px", fontSize: 17, background: "transparent", border: "none", borderBottom: tab === id ? "2px solid #2a9d5c" : "2px solid transparent", color: tab === id ? "#e6e6e8" : "#3a4050", cursor: "pointer", fontWeight: tab === id ? 700 : 400 }}>
                {lbl}
              </button>
            ))}
          </div>

          {/* ─── PLAYBOOK TAB ─────────────────────────────────────────────── */}
          {tab === "playbook" && (
            <div>
              {/* Header */}
              <div style={{ ...S.card, border: "1px solid #1a2a3a", marginBottom: 12 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 22 }}>⚡</span>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: "#111122", marginBottom: 3 }}>Macro Playbook — AI Event Intelligence</div>
                    <div style={{ fontSize: 17, color: "#555577", lineHeight: 1.6 }}>
                      Select a macro event below. Claude reads the <strong style={{ color: "#1a1a2e" }}>current macro snapshot</strong> (rates, CPI, GDP, real yields) and tells you exactly how each asset class will react — with India-specific impact and contrarian view.
                    </div>
                  </div>
                </div>
              </div>

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
                      background: playbookEvent?.id === ev.id ? "#091a10" : "#0e1117",
                      border: `1px solid ${playbookEvent?.id === ev.id ? "#2a9d5c" : "#1c2028"}`,
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
                      <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 3, background: "#f5f6f8", color: ev.color, fontWeight: 700 }}>{ev.category}</span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a2e", marginBottom: 2, lineHeight: 1.3 }}>{ev.label}</div>
                    <div style={{ fontSize: 11, color: "#7a7c99", lineHeight: 1.3 }}>{ev.desc}</div>
                  </button>
                ))}
              </div>

              {/* Loading */}
              {playbookLoading && (
                <div style={{ ...S.card, border: "1px solid #1a2a1a", textAlign: "center", padding: "28px 12px" }}>
                  <div style={{ width: 20, height: 20, border: "2px solid #1c2028", borderTopColor: "#2a9d5c", borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto 10px" }} />
                  <div style={{ fontSize: 17, color: "#555577" }}>Claude is reading the current macro environment and reasoning through market impacts...</div>
                </div>
              )}

              {/* Result */}
              {playbookResult && !playbookLoading && !playbookResult.error && (
                <div style={{ animation: "fadeIn .3s ease" }}>
                  {/* Headline */}
                  <div style={{ ...S.card, border: `1px solid ${playbookResult.regime === "RISK-ON" ? "#2a9d5c" : playbookResult.regime === "RISK-OFF" ? "#d64040" : "#e9a825"}`, marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontSize: 11, color: "#7a7c99", marginBottom: 4 }}>AI MACRO VERDICT · {playbookEvent?.label?.toUpperCase()}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: "#111122", lineHeight: 1.3 }}>{playbookResult.headline}</div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                        <span style={{
                          fontSize: 12, fontWeight: 700, padding: "3px 8px", borderRadius: 4,
                          background: playbookResult.regime === "RISK-ON" ? "#091408" : playbookResult.regime === "RISK-OFF" ? "#160606" : "#1a1200",
                          color: playbookResult.regime === "RISK-ON" ? "#2a9d5c" : playbookResult.regime === "RISK-OFF" ? "#d64040" : "#e9a825"
                        }}>{playbookResult.regime}</span>
                        <span style={{ fontSize: 11, color: "#8a8caa" }}>{playbookResult.timeframe}</span>
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
                            background: a.direction === "UP" ? "#091408" : a.direction === "DOWN" ? "#160606" : "#121518",
                            color: a.direction === "UP" ? "#2a9d5c" : a.direction === "DOWN" ? "#d64040" : "#3a4050"
                          }}>
                            {a.direction === "UP" ? "▲" : a.direction === "DOWN" ? "▼" : "—"} {a.magnitude}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#1a1a2e", marginBottom: 3 }}>{a.name}</div>
                        <div style={{ fontSize: 11, color: "#7a7c99", lineHeight: 1.4 }}>{a.reason}</div>
                      </div>
                    ))}
                  </div>

                  {/* India Impact */}
                  <div style={{ ...S.card, border: "1px solid #1a2a1a", marginBottom: 8 }}>
                    <div style={S.label}>🇮🇳 India-specific impact</div>
                    <div style={{ fontSize: 17, color: "#2a2a3e", lineHeight: 1.7 }}>{playbookResult.india_impact}</div>
                  </div>

                  {/* Watch + Contrarian */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div style={{ ...S.card, marginBottom: 0, border: "1px solid #1a2028" }}>
                      <div style={S.label}>👁 Watch next 48h</div>
                      <div style={{ fontSize: 17, color: "#e9a825", lineHeight: 1.5 }}>{playbookResult.watch_next}</div>
                    </div>
                    <div style={{ ...S.card, marginBottom: 0, border: "1px solid #1a1a2a" }}>
                      <div style={S.label}>🔄 Contrarian take</div>
                      <div style={{ fontSize: 17, color: "#2a2a3e", lineHeight: 1.5 }}>{playbookResult.contrarian}</div>
                    </div>
                  </div>
                </div>
              )}

              {playbookResult?.error && (
                <div style={{ ...S.card, color: "#d64040", fontSize: 11 }}>{playbookResult.error}</div>
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
                          <div style={{ fontSize: 12, color: "#1a1a2e" }}>{h.event.label}</div>
                          <div style={{ fontSize: 11, color: "#8a8caa" }}>{h.time}</div>
                        </div>
                      </div>
                      <span style={{
                        fontSize: 11, padding: "1px 6px", borderRadius: 3, fontWeight: 700,
                        background: h.result.regime === "RISK-ON" ? "#091408" : h.result.regime === "RISK-OFF" ? "#160606" : "#1a1200",
                        color: h.result.regime === "RISK-ON" ? "#2a9d5c" : h.result.regime === "RISK-OFF" ? "#d64040" : "#e9a825"
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
                {Object.keys(MACRO).map(c => (
                  <button key={c} onClick={() => setCountry(c)} style={{ padding: "3px 10px", borderRadius: 5, border: "1px solid", borderColor: country === c ? "#2a9d5c" : "#1c2028", background: country === c ? "#091a10" : "#0e1117", color: country === c ? "#2a9d5c" : "#3a4050", fontSize: 17, cursor: "pointer" }}>
                    {FLAGS[c]} {c}
                  </button>
                ))}
              </div>

              {/* Country Macro */}
              <div style={{ ...S.card, marginBottom: 12 }}>
                <div style={S.label}>{FLAGS[country]} {country} · Macro Variables</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
                  {[
                    ["CPI", mv.inflation + "%", mv.inflation > 5 ? "#d64040" : mv.inflation < 2 ? "#4a8cd4" : "#e9a825"],
                    ["Policy Rate", mv.rate + "%", "#c8c8ca"],
                    ["Real Yield", (mv.real_yield > 0 ? "+" : "") + mv.real_yield.toFixed(2) + "%", mv.real_yield < 0 ? "#d64040" : mv.real_yield > 2 ? "#2a9d5c" : "#e9a825"],
                    ["GDP", mv.gdp + "%", mv.gdp > 5 ? "#2a9d5c" : mv.gdp > 2 ? "#e9a825" : "#d64040"],
                    ["Extra", mv.extra, "#c8c8ca"],
                    ["Oil", "$84.2", "#e87040"],
                    ["Net Flow", country === "US" ? "Receiving" : country === "JP" ? "Sending" : "Mixed", country === "US" ? "#2a9d5c" : "#e9a825"],
                    ["Trend", country === "US" ? "Bullish" : country === "IN" ? "Cautious" : "Neutral", country === "US" ? "#2a9d5c" : "#e9a825"],
                  ].map(([lbl, val, col]) => (
                    <div key={lbl} style={{ background: "#f5f6f8", borderRadius: 5, padding: "7px 8px" }}>
                      <div style={{ fontSize: 11, color: "#8a8caa", marginBottom: 2 }}>{lbl}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: col }}>{val}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 8, padding: "6px 8px", background: "#f5f6f8", borderRadius: 5, fontSize: 17, color: "#555577", lineHeight: 1.6 }}>
                  <strong style={{ color: "#1a1a2e" }}>Real Yield</strong> = {mv.rate}% − {mv.inflation}% = <strong style={{ color: mv.real_yield < 0 ? "#d64040" : mv.real_yield > 2 ? "#2a9d5c" : "#e9a825" }}>{(mv.real_yield > 0 ? "+" : "") + mv.real_yield.toFixed(2)}%</strong>
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
                    <div key={asset} style={{ ...S.card, marginBottom: 0, border: `1px solid ${isTop ? "#2a9d5c" : "#1c2028"}`, position: "relative" }}>
                      {isTop && <div style={{ position: "absolute", top: -1, right: 6, fontSize: 10, background: "#2a9d5c", color: "#001a0a", padding: "1px 5px", borderRadius: "0 0 4px 4px", fontWeight: 700 }}>TOP</div>}
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 16 }}>{ASSET_ICONS[asset]}</span>
                        <span style={{ fontSize: 11, padding: "2px 5px", borderRadius: 3, color: col, fontWeight: 700 }}>{lbl}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#555577", marginBottom: 2 }}>{ASSET_LABELS[asset]}</div>
                      <div style={{ fontSize: 26, fontWeight: 700, color: col }}>{sc}</div>
                      <div style={{ height: 3, background: "#eef0f4", borderRadius: 2, overflow: "hidden", marginTop: 4 }}>
                        <div style={{ height: "100%", width: sc + "%", background: col, transition: "width .6s" }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* AI Analysis */}
              <div style={{ ...S.card, border: "1px solid #1a2a1a" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                  <span style={S.label}>AI Macro Analyst · Live Headlines</span>
                  <button onClick={callAI} style={{ fontSize: 12, padding: "3px 10px", background: "#eafaf2", border: "1px solid #2a9d5c", borderRadius: 5, color: "#2a9d5c", cursor: "pointer" }}>
                    {aiLoading ? "Analyzing..." : "Analyze now ↗"}
                  </button>
                </div>
                {aiText
                  ? <div style={{ fontSize: 17, color: "#2a2a3e", lineHeight: 1.7 }}>{aiText}</div>
                  : <div style={{ fontSize: 17, color: "#8a8caa", fontStyle: "italic" }}>Click "Analyze now" — Claude reads today's actual headlines and gives you a macro brief.</div>
                }
              </div>
            </>
          )}

          {tab === "yield" && (
            <>
              <div style={S.label}>Real Yield · All Countries</div>
              <div style={{ ...S.card, fontSize: 17, color: "#555577", lineHeight: 1.7, marginBottom: 12 }}>
                <strong style={{ color: "#1a1a2e" }}>Real Yield = Nominal Rate − CPI Inflation.</strong> Negative = money leaves bonds for gold/equities. High positive = bonds attract capital.
              </div>
              {Object.entries(MACRO).map(([c, mv]) => {
                const ry = mv.real_yield; const neg = ry < 0; const w = Math.min(Math.abs(ry) / 6 * 100, 85);
                return (
                  <div key={c} style={{ ...S.card }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 12 }}>{FLAGS[c]} {c}</span>
                      <div style={{ display: "flex", gap: 10, fontSize: 17, color: "#7a7c99" }}>
                        <span>Rate: <strong style={{ color: "#1a1a2e" }}>{mv.rate}%</strong></span>
                        <span>CPI: <strong style={{ color: "#1a1a2e" }}>{mv.inflation}%</strong></span>
                        <strong style={{ color: neg ? "#d64040" : ry > 2 ? "#2a9d5c" : "#e9a825" }}>Real: {ry > 0 ? "+" : ""}{ry.toFixed(2)}%</strong>
                      </div>
                    </div>
                    <div style={{ height: 6, background: "#eef0f4", borderRadius: 3, overflow: "hidden", marginBottom: 5 }}>
                      <div style={{ float: neg ? "right" : "left", width: w + "%", height: "100%", background: neg ? "#d64040" : ry > 2 ? "#2a9d5c" : "#e9a825", borderRadius: 3 }} />
                    </div>
                    <div style={{ fontSize: 12, color: "#2a3a50" }}>
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
              <div style={{ ...S.card, fontSize: 17, color: "#555577", marginBottom: 12 }}>
                Live: <strong style={{ color: "#1a1a2e" }}>BoJ 0.1%</strong> · <strong style={{ color: "#1a1a2e" }}>US10Y 4.42%</strong> · <strong style={{ color: "#1a1a2e" }}>VIX 18.4</strong> · <strong style={{ color: "#1a1a2e" }}>Gold $2,340</strong>
              </div>
              {alerts.map(a => (
                <div key={a.id} style={{ ...S.card, opacity: a.active ? 1 : 0.5 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 17, color: "#1a1a2e", fontWeight: 600 }}>{a.label}</span>
                    <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 12, color: "#7a7c99" }}>
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
                      <span key={asset} style={{ fontSize: 17, padding: "2px 8px", borderRadius: 4, background: delta > 0 ? "#091408" : "#160606", color: delta > 0 ? "#2a9d5c" : "#d64040" }}>
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
                { from: "🇯🇵 Japan", to: "🇺🇸 USA", size: "$2.8T", col: "#2a9d5c", reason: "Carry trade — borrow JPY 0.1%, buy UST 4.4%", strength: 92 },
                { from: "🇸🇦 Gulf", to: "🇺🇸 USA", size: "~$600B", col: "#2a9d5c", reason: "Petrodollar recycling into US equities and T-bills", strength: 75 },
                { from: "🇪🇺 Europe", to: "🇺🇸 USA", size: "~$400B", col: "#e9a825", reason: "ECB cutting — EUR capital seeking higher US returns", strength: 58 },
                { from: "🇮🇳 India", to: "🇺🇸 USA", size: "$4.2B", col: "#d64040", reason: "FPI outflow — USD yield differential too wide", strength: 42 },
                { from: "🇨🇳 China", to: "🥇 Gold", size: "Divesting", col: "#e9a825", reason: "PBOC buying gold, reducing US Treasury exposure", strength: 55 },
              ].map((f, i) => (
                <div key={i} style={{ ...S.card }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: "#444466", minWidth: 80 }}>{f.from}</span>
                    <div style={{ flex: 1, height: 2, background: "#eef0f4", borderRadius: 1, position: "relative" }}>
                      <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: f.strength + "%", background: f.col, transition: "width .5s" }} />
                      <span style={{ position: "absolute", right: -8, top: -7, fontSize: 12, color: f.col }}>→</span>
                    </div>
                    <span style={{ fontSize: 12, color: "#111122", fontWeight: 600, minWidth: 55 }}>{f.to}</span>
                    <span style={{ fontSize: 12, color: f.col, fontWeight: 700, minWidth: 50, textAlign: "right" }}>{f.size}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#7a7c99" }}>{f.reason}</div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* RIGHT — VERDICT */}
        <div style={S.right}>
          <div style={S.label}>Live Verdict</div>
          <div style={{ background: "#eafaf2", border: "1px solid #2a9d5c", borderRadius: 8, padding: 12, marginBottom: 8, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#2a9d5c", marginBottom: 3 }}>MONEY FLOWING TO</div>
            <div style={{ fontSize: 26, marginBottom: 2 }}>{ASSET_ICONS[topAsset[0]]}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#2a9d5c" }}>{ASSET_LABELS[topAsset[0]]}</div>
            <div style={{ fontSize: 12, color: "#7a7c99", marginTop: 3 }}>Score: {Math.round(topAsset[1])}/100</div>
          </div>
          <div style={{ background: "#fdecea", border: "1px solid #d64040", borderRadius: 8, padding: 12, marginBottom: 12, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#d64040", marginBottom: 3 }}>CAPITAL LEAVING</div>
            <div style={{ fontSize: 26, marginBottom: 2 }}>{ASSET_ICONS[bottomAsset[0]]}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#d64040" }}>{ASSET_LABELS[bottomAsset[0]]}</div>
            <div style={{ fontSize: 12, color: "#7a7c99", marginTop: 3 }}>Score: {Math.round(bottomAsset[1])}/100</div>
          </div>

          <div style={S.label}>By Country</div>
          {[
            { c: "🇺🇸", n: "USA", flow: "Receiving", col: "#2a9d5c", detail: "Equities + T-bills" },
            { c: "🇯🇵", n: "Japan", flow: "Sending", col: "#e9a825", detail: "Carry → USD" },
            { c: "🇮🇳", n: "India", flow: "Outflow", col: "#d64040", detail: "FPI leaving" },
            { c: "🇨🇳", n: "China", flow: "Diverging", col: "#e9a825", detail: "UST → Gold" },
            { c: "🇰🇷", n: "Korea", flow: "Neutral", col: "#3a4050", detail: "Export risk" },
          ].map(f => (
            <div key={f.c} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #121518" }}>
              <div style={{ fontSize: 11 }}><span style={{ marginRight: 5 }}>{f.c}</span><span style={{ color: "#444466" }}>{f.n}</span></div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: f.col }}>{f.flow}</div>
                <div style={{ fontSize: 11, color: "#8a8caa" }}>{f.detail}</div>
              </div>
            </div>
          ))}

          <div style={{ marginTop: 12 }}><div style={S.label}>Risk Radar</div></div>
          {[
            ["BoJ hike", "HIGH", "#d64040", "Carry unwind"],
            ["US inflation", "MED", "#e9a825", "Fed hawkish"],
            ["Rupee", "MED", "#e9a825", "INR at 83.6"],
            ["China PMI", "MED", "#e9a825", "EM drag"],
            ["Dollar", "LOW", "#2a9d5c", "DXY softening"],
          ].map(([r, lv, col, sub]) => (
            <div key={r} style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
              <div>
                <div style={{ fontSize: 12, color: "#444466" }}>{r}</div>
                <div style={{ fontSize: 11, color: "#8a8caa" }}>{sub}</div>
              </div>
              <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 3, background: col + "18", color: col, fontWeight: 700 }}>{lv}</span>
            </div>
          ))}

          {/* Playbook shortcut in sidebar */}
          {playbookResult && !playbookResult.error && (
            <div style={{ marginTop: 12, padding: 8, background: "#ffffff", border: "1px solid #1c2028", borderRadius: 6 }}>
              <div style={S.label}>Last Playbook · {playbookEvent?.label}</div>
              <div style={{ fontSize: 12, color: "#1a1a2e", marginBottom: 4 }}>{playbookResult.headline}</div>
              <button onClick={() => setTab("playbook")} style={{ fontSize: 11, padding: "2px 8px", background: "#eafaf2", border: "1px solid #2a9d5c", borderRadius: 4, color: "#2a9d5c", cursor: "pointer" }}>
                View full analysis ↗
              </button>
            </div>
          )}

          <div style={{ marginTop: 10, padding: 8, background: "#ffffff", borderRadius: 6, fontSize: 12, color: "#8a8caa", lineHeight: 1.6 }}>
            <strong style={{ color: "#1a1a2e" }}>Watch: </strong>
            BoJ Jul 31. Signal above 0.25% = carry unwind. RBI Aug = rate cut signal for India.
          </div>
        </div>
      </div>
    </div>
  );
}
