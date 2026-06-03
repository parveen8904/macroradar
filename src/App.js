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

  const mv = MACRO[country];
  const topAsset    = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  const bottomAsset = Object.entries(scores).sort((a, b) => a[1] - b[1])[0];
  const fmt = (v, d = 2) => v ? Number(v).toFixed(d) : "—";

  const S = {
    page:    { background: "#0a0c0f", minHeight: "100vh", color: "#c8c8ca", fontFamily: "system-ui, sans-serif", fontSize: 13 },
    header:  { background: "#0e1117", borderBottom: "1px solid #1c2028", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 },
    ticker:  { background: "#0c0f14", borderBottom: "1px solid #1c2028", padding: "6px 16px", display: "flex", gap: 20, overflowX: "auto", whiteSpace: "nowrap", alignItems: "center" },
    grid:    { display: "grid", gridTemplateColumns: "300px 1fr 260px", minHeight: "calc(100vh - 76px)" },
    left:    { borderRight: "1px solid #1c2028", display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 76px)", overflow: "hidden" },
    center:  { padding: "12px 16px", overflowY: "auto", maxHeight: "calc(100vh - 76px)" },
    right:   { borderLeft: "1px solid #1c2028", padding: "12px 10px", overflowY: "auto", maxHeight: "calc(100vh - 76px)" },
    card:    { background: "#0e1117", border: "1px solid #1c2028", borderRadius: 8, padding: "10px 12px", marginBottom: 8 },
    label:   { fontSize: 9, color: "#3a4050", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 6 },
    dot:     { width: 7, height: 7, borderRadius: "50%", background: "#2a9d5c", animation: "pulse 2s infinite" },
    blink:   { width: 5, height: 5, borderRadius: "50%", background: "#2a9d5c", animation: "blink 1.5s infinite" },
  };

  return (
    <div style={S.page}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        a { color: inherit; text-decoration: none; }
        a:hover { color: #e6e6e8; }
        input[type=range] { accent-color: #2a9d5c; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #0a0c0f; }
        ::-webkit-scrollbar-thumb { background: #1c2028; border-radius: 2px; }
      `}</style>

      {/* HEADER */}
      <div style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={S.dot} />
          <span style={{ fontWeight: 700, fontSize: 15, color: "#e6e6e8", letterSpacing: ".04em" }}>MACRORADAR.IN</span>
          <span style={{ fontSize: 10, color: "#3a4050" }}>Global Capital Flow Intelligence · Live</span>
        </div>
        <span style={{ fontSize: 10, color: "#3a4050" }}>June 03, 2026</span>
      </div>

      {/* TICKER */}
      <div style={S.ticker}>
        {[["GLD", prices.gold, "$", 2], ["BTC", prices.btc, "$", 0], ["INR/USD", prices.inrusd, "₹", 2], ["JPY/USD", prices.jpyusd, "¥", 1]].map(([l, v, s, d]) => (
          <span key={l} style={{ fontSize: 11 }}>
            <span style={{ color: "#3a4050" }}>{l} </span>
            <span style={{ color: v ? "#e6e6e8" : "#3a4050", fontWeight: 600 }}>{v ? s + fmt(v, d) : "loading..."}</span>
          </span>
        ))}
        {[["Oil", "$84.2"], ["VIX", "18.4"], ["DXY", "104.2"], ["US10Y", "4.42%"]].map(([l, v]) => (
          <span key={l} style={{ fontSize: 11 }}>
            <span style={{ color: "#3a4050" }}>{l} </span>
            <span style={{ color: "#e6e6e8", fontWeight: 600 }}>{v}</span>
          </span>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 9, color: "#3a4050" }}>{priceStatus}</span>
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
                <span style={{ fontSize: 9, color: "#3a4050" }}>{newsStatus}</span>
              </div>
            </div>
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {news.length === 0 && (
              <div style={{ padding: 20, color: "#3a4050", fontSize: 11, textAlign: "center" }}>
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
                      <span style={{ fontSize: 9, color: "#2a4060", background: "#0e1520", padding: "1px 5px", borderRadius: 3 }}>{n.source}</span>
                      <span style={{ fontSize: 9, color: "#2a3040" }}>{timeAgo(n.pubDate)}</span>
                    </div>
                    <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: bull ? "#0a1a10" : bear ? "#1a0808" : "#121518", color: bull ? "#2a9d5c" : bear ? "#d64040" : "#3a4050", fontWeight: 700 }}>
                      {n.sentiment}
                    </span>
                  </div>
                  <a href={n.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#b4b4b6", lineHeight: 1.45, display: "block", marginBottom: 5 }}>
                    {n.title}
                  </a>
                  <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 5 }}>
                    {[["EQ", n.eq], ["BD", n.bonds], ["AU", n.gold], ["RE", n.realty], ["$", n.dollar]].map(([lbl, val]) =>
                      val !== 0 ? (
                        <span key={lbl} style={{ fontSize: 9, padding: "1px 4px", borderRadius: 2, background: val > 0 ? "#091408" : "#160606", color: val > 0 ? "#2a9d5c" : "#d64040" }}>
                          {lbl} {val > 0 ? "+" : ""}{val}
                        </span>
                      ) : null
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 9, color: "#2a3040", minWidth: 55 }}>Your weight</span>
                    <input type="range" min={0} max={10} value={uw} onChange={e => setUserWeights(p => ({ ...p, [n.id]: parseInt(e.target.value) }))} style={{ flex: 1, height: 2 }} />
                    <span style={{ fontSize: 10, color: "#2a9d5c", fontWeight: 700, minWidth: 12 }}>{uw}</span>
                    <span style={{ fontSize: 9, color: "#2a3040" }}>AI:{n.aiWeight}</span>
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
            {[["news", "Overview"], ["yield", "Real Yield"], ["alerts", "⚑ Alerts"], ["flows", "Flow Map"]].map(([id, lbl]) => (
              <button key={id} onClick={() => setTab(id)} style={{ padding: "5px 14px", fontSize: 11, background: "transparent", border: "none", borderBottom: tab === id ? "2px solid #2a9d5c" : "2px solid transparent", color: tab === id ? "#e6e6e8" : "#3a4050", cursor: "pointer", fontWeight: tab === id ? 700 : 400 }}>
                {lbl}
              </button>
            ))}
          </div>

          {tab === "news" && (
            <>
              {/* Country Tabs */}
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                {Object.keys(MACRO).map(c => (
                  <button key={c} onClick={() => setCountry(c)} style={{ padding: "3px 10px", borderRadius: 5, border: "1px solid", borderColor: country === c ? "#2a9d5c" : "#1c2028", background: country === c ? "#091a10" : "#0e1117", color: country === c ? "#2a9d5c" : "#3a4050", fontSize: 11, cursor: "pointer" }}>
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
                    <div key={lbl} style={{ background: "#0a0c0f", borderRadius: 5, padding: "7px 8px" }}>
                      <div style={{ fontSize: 9, color: "#2a3040", marginBottom: 2 }}>{lbl}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: col }}>{val}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 8, padding: "6px 8px", background: "#0a0c0f", borderRadius: 5, fontSize: 11, color: "#5a5c6e", lineHeight: 1.6 }}>
                  <strong style={{ color: "#c8c8ca" }}>Real Yield</strong> = {mv.rate}% − {mv.inflation}% = <strong style={{ color: mv.real_yield < 0 ? "#d64040" : mv.real_yield > 2 ? "#2a9d5c" : "#e9a825" }}>{(mv.real_yield > 0 ? "+" : "") + mv.real_yield.toFixed(2)}%</strong>
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
                      {isTop && <div style={{ position: "absolute", top: -1, right: 6, fontSize: 8, background: "#2a9d5c", color: "#001a0a", padding: "1px 5px", borderRadius: "0 0 4px 4px", fontWeight: 700 }}>TOP</div>}
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 16 }}>{ASSET_ICONS[asset]}</span>
                        <span style={{ fontSize: 9, padding: "2px 5px", borderRadius: 3, color: col, fontWeight: 700 }}>{lbl}</span>
                      </div>
                      <div style={{ fontSize: 10, color: "#5a5c6e", marginBottom: 2 }}>{ASSET_LABELS[asset]}</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: col }}>{sc}</div>
                      <div style={{ height: 3, background: "#1a1d23", borderRadius: 2, overflow: "hidden", marginTop: 4 }}>
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
                  <button onClick={callAI} style={{ fontSize: 10, padding: "3px 10px", background: "#091a10", border: "1px solid #2a9d5c", borderRadius: 5, color: "#2a9d5c", cursor: "pointer" }}>
                    {aiLoading ? "Analyzing..." : "Analyze now ↗"}
                  </button>
                </div>
                {aiText
                  ? <div style={{ fontSize: 11, color: "#b4b4b6", lineHeight: 1.7 }}>{aiText}</div>
                  : <div style={{ fontSize: 11, color: "#2a3040", fontStyle: "italic" }}>Click "Analyze now" — Claude reads today's actual headlines and gives you a macro brief.</div>
                }
              </div>
            </>
          )}

          {tab === "yield" && (
            <>
              <div style={S.label}>Real Yield · All Countries</div>
              <div style={{ ...S.card, fontSize: 11, color: "#5a5c6e", lineHeight: 1.7, marginBottom: 12 }}>
                <strong style={{ color: "#c8c8ca" }}>Real Yield = Nominal Rate − CPI Inflation.</strong> Negative = money leaves bonds for gold/equities. High positive = bonds attract capital.
              </div>
              {Object.entries(MACRO).map(([c, mv]) => {
                const ry = mv.real_yield; const neg = ry < 0; const w = Math.min(Math.abs(ry) / 6 * 100, 85);
                return (
                  <div key={c} style={{ ...S.card }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 12 }}>{FLAGS[c]} {c}</span>
                      <div style={{ display: "flex", gap: 10, fontSize: 11, color: "#3a4050" }}>
                        <span>Rate: <strong style={{ color: "#c8c8ca" }}>{mv.rate}%</strong></span>
                        <span>CPI: <strong style={{ color: "#c8c8ca" }}>{mv.inflation}%</strong></span>
                        <strong style={{ color: neg ? "#d64040" : ry > 2 ? "#2a9d5c" : "#e9a825" }}>Real: {ry > 0 ? "+" : ""}{ry.toFixed(2)}%</strong>
                      </div>
                    </div>
                    <div style={{ height: 6, background: "#121518", borderRadius: 3, overflow: "hidden", marginBottom: 5 }}>
                      <div style={{ float: neg ? "right" : "left", width: w + "%", height: "100%", background: neg ? "#d64040" : ry > 2 ? "#2a9d5c" : "#e9a825", borderRadius: 3 }} />
                    </div>
                    <div style={{ fontSize: 10, color: "#2a3a50" }}>
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
              <div style={{ ...S.card, fontSize: 11, color: "#5a5c6e", marginBottom: 12 }}>
                Live: <strong style={{ color: "#c8c8ca" }}>BoJ 0.1%</strong> · <strong style={{ color: "#c8c8ca" }}>US10Y 4.42%</strong> · <strong style={{ color: "#c8c8ca" }}>VIX 18.4</strong> · <strong style={{ color: "#c8c8ca" }}>Gold $2,340</strong>
              </div>
              {alerts.map(a => (
                <div key={a.id} style={{ ...S.card, opacity: a.active ? 1 : 0.5 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: "#c8c8ca", fontWeight: 600 }}>{a.label}</span>
                    <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 10, color: "#3a4050" }}>
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
                      <span key={asset} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: delta > 0 ? "#091408" : "#160606", color: delta > 0 ? "#2a9d5c" : "#d64040" }}>
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
                    <span style={{ fontSize: 12, color: "#7a7c8e", minWidth: 80 }}>{f.from}</span>
                    <div style={{ flex: 1, height: 2, background: "#121518", borderRadius: 1, position: "relative" }}>
                      <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: f.strength + "%", background: f.col, transition: "width .5s" }} />
                      <span style={{ position: "absolute", right: -8, top: -7, fontSize: 12, color: f.col }}>→</span>
                    </div>
                    <span style={{ fontSize: 12, color: "#e6e6e8", fontWeight: 600, minWidth: 55 }}>{f.to}</span>
                    <span style={{ fontSize: 10, color: f.col, fontWeight: 700, minWidth: 50, textAlign: "right" }}>{f.size}</span>
                  </div>
                  <div style={{ fontSize: 10, color: "#3a4050" }}>{f.reason}</div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* RIGHT — VERDICT */}
        <div style={S.right}>
          <div style={S.label}>Live Verdict</div>
          <div style={{ background: "#091a10", border: "1px solid #2a9d5c", borderRadius: 8, padding: 12, marginBottom: 8, textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "#2a9d5c", marginBottom: 3 }}>MONEY FLOWING TO</div>
            <div style={{ fontSize: 22, marginBottom: 2 }}>{ASSET_ICONS[topAsset[0]]}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#2a9d5c" }}>{ASSET_LABELS[topAsset[0]]}</div>
            <div style={{ fontSize: 10, color: "#3a4050", marginTop: 3 }}>Score: {Math.round(topAsset[1])}/100</div>
          </div>
          <div style={{ background: "#160606", border: "1px solid #d64040", borderRadius: 8, padding: 12, marginBottom: 12, textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "#d64040", marginBottom: 3 }}>CAPITAL LEAVING</div>
            <div style={{ fontSize: 22, marginBottom: 2 }}>{ASSET_ICONS[bottomAsset[0]]}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#d64040" }}>{ASSET_LABELS[bottomAsset[0]]}</div>
            <div style={{ fontSize: 10, color: "#3a4050", marginTop: 3 }}>Score: {Math.round(bottomAsset[1])}/100</div>
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
              <div style={{ fontSize: 11 }}><span style={{ marginRight: 5 }}>{f.c}</span><span style={{ color: "#7a7c8e" }}>{f.n}</span></div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: f.col }}>{f.flow}</div>
                <div style={{ fontSize: 9, color: "#2a3040" }}>{f.detail}</div>
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
                <div style={{ fontSize: 10, color: "#7a7c8e" }}>{r}</div>
                <div style={{ fontSize: 9, color: "#2a3040" }}>{sub}</div>
              </div>
              <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, background: col + "18", color: col, fontWeight: 700 }}>{lv}</span>
            </div>
          ))}

          <div style={{ marginTop: 10, padding: 8, background: "#0e1117", borderRadius: 6, fontSize: 10, color: "#2a3040", lineHeight: 1.6 }}>
            <strong style={{ color: "#c8c8ca" }}>Watch: </strong>
            BoJ Jul 31. Signal above 0.25% = carry unwind. RBI Aug = rate cut signal for India.
          </div>
        </div>
      </div>
    </div>
  );
}
