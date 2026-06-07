# MacroRadar — Project Deep Dive

## What Is This?

**MacroRadar** (branded as `MACRORADAR.IN`) is a real-time global macro intelligence dashboard built as a React single-page application. It is designed for macro-aware investors — primarily with an Indian investor lens — who want to understand where global capital is flowing and how major macroeconomic events impact different asset classes.

The entire product lives in one file: `src/App.js` (~870 lines). It was bootstrapped with Create React App and is at an early prototype / v0.1 stage.

---

## Core Thesis

> **The problem:** Most retail investors consume financial news reactively. They read a headline and don't know whether to buy, sell, or hold — or which asset class is affected and why.

> **The solution:** MacroRadar takes live financial headlines, scores them against each asset class automatically (using keyword heuristics + AI), and surfaces a real-time verdict: *where is money flowing right now, and why?*

> **The angle:** Global macro + India-specific. The app is tuned for Indian investors tracking FPI flows, INR, Nifty, and RBI policy — alongside global moves in the Fed, BoJ, China, and carry trades.

---

## Architecture: How It Works

### 1. Live News Ingestion (Left Column)

The app fetches RSS feeds from five sources every 2 minutes via the `allorigins.win` CORS proxy:

| Source | Flag | Focus |
|---|---|---|
| Economic Times | 🇮🇳 | Indian markets/economy |
| Moneycontrol | 🇮🇳 | Indian markets/economy |
| Reuters Business | 🌐 | Global macro |
| US Federal Reserve | 🇺🇸 | Fed policy announcements |
| RBI | 🇮🇳 | India central bank |

Each headline is passed through `classifyImpact(title)` — a keyword-scoring engine that outputs integer deltas for each asset class:

```
"Rate cut" / "dovish" → Equities +4, Bonds +5, Gold +2, Real Estate +3, Dollar -3
"Inflation" / "CPI"   → Equities -2, Bonds -3, Gold +5, Dollar +2
"Recession"           → Equities -4, Gold +5, Bonds +3
"FPI inflow"          → Equities +4, Bonds +2
```

Each news item also gets:
- A **sentiment tag**: `RISK-ON`, `RISK-OFF`, or `NEUTRAL` (based on combined net delta)
- An **AI weight** (4–9): how much this headline should influence asset scores
- A **user weight slider**: lets the user override the AI weight per headline (persists for the session)

---

### 2. Asset Score Engine (Dynamic, News-Weighted)

Six asset classes are tracked with a **baseline score** (0–100):

| Asset | Baseline |
|---|---|
| Equities | 52 |
| Bonds | 48 |
| Gold | 62 |
| Real Estate | 28 |
| Dollar/Cash | 60 |
| Crypto | 44 |

Every time news loads or a user adjusts a weight, the engine recomputes scores by blending:
- **60% user weight** + **40% AI weight** for each headline
- Accumulates weighted deltas across the top 20 headlines
- Clamps final scores to 5–95

Score interpretation:
- **≥ 65** → BULLISH (green) — capital flowing in
- **48–64** → NEUTRAL (yellow) — mixed signals
- **< 48** → BEARISH (red) — capital leaving

The top-scoring and bottom-scoring asset are shown in the right sidebar as the "Live Verdict."

---

### 3. Live Price Ticker (Top Bar)

Fetches real-time prices every 60 seconds from **Alpha Vantage API**:
- Gold (via GLD ETF price)
- BTC/USD
- USD/INR exchange rate
- USD/JPY exchange rate

Also shows hardcoded values (not yet live-fetched): Oil ($84.2), VIX (18.4), DXY (104.2), US10Y (4.42%).

---

### 4. The Five Tabs (Center Panel)

#### Tab 1: Overview (News)
- Country switcher: US 🇺🇸, India 🇮🇳, Japan 🇯🇵, China 🇨🇳, Korea 🇰🇷
- Each country shows: CPI, Policy Rate, Real Yield, GDP, and a note item
- **Real Yield formula displayed inline**: Policy Rate − CPI Inflation
  - Negative real yield → capital flees bonds → flows to gold/equities
  - High positive real yield → bonds attract capital
- Asset score grid (6 cards, live-updating)
- **AI Macro Analyst button**: on click, sends top 6 headlines + current scores to Claude and gets a 4-sentence macro brief:
  1. Where is money flowing and why?
  2. Biggest risk next 30 days?
  3. What should an Indian investor watch?
  4. One contrarian view?

#### Tab 2: Playbook ⚡ (AI Event Scenarios)
The flagship differentiator. A grid of 12 pre-defined macro events:

| Event | Category |
|---|---|
| Strong Jobs Report | US |
| Fed Rate Hike | US |
| Fed Rate Cut | US |
| Hot CPI Surprise | US |
| BoJ Rate Hike | JP |
| China Stimulus | CN |
| RBI Rate Cut | IN |
| Oil Price Spike | Global |
| Recession Signal | US |
| Gold Breakout | Global |
| Dollar Crash | US |
| FPI Surge India | IN |

When you click an event, MacroRadar sends a structured prompt to **Claude Sonnet** with:
- The event name + description
- The current macro snapshot (CPI, rates, real yields, GDP for all 5 countries)
- The current live asset scores

Claude responds in **strict JSON** (enforced in the prompt):
```json
{
  "headline": "punchy 8-word market reaction summary",
  "regime": "RISK-ON | RISK-OFF | MIXED",
  "assets": [ { name, icon, direction (UP/DOWN/FLAT), magnitude, reason } × 6 ],
  "india_impact": "2 sentences on Nifty, INR, FPI flows, RBI response",
  "watch_next": "most important indicator in next 48 hours",
  "contrarian": "one take most investors will miss",
  "timeframe": "immediate | short-term | medium-term"
}
```

The result renders as:
- Color-coded regime badge (RISK-ON = green, RISK-OFF = red, MIXED = yellow)
- Per-asset reaction cards with ▲/▼/— and magnitude range
- India-specific impact panel
- "Watch next 48h" + "Contrarian take" side by side
- Playbook run history (last 5 events, clickable to restore)
- A shortcut also appears in the right sidebar after each run

#### Tab 3: Real Yield
Visual comparison of real yields across all 5 countries with bar indicators. Explains carry trade mechanics: Japan's -2.6% real yield makes JPY the funding currency for the largest carry trade in the world.

#### Tab 4: Alerts ⚑
Three pre-configured threshold alerts:
- BoJ Rate > 0.5%
- US 10Y > 5%
- VIX > 25

Each shows the expected asset class impact deltas if triggered. Toggle on/off. (Currently display-only — no automated notification system yet.)

#### Tab 5: Flow Map
Five hardcoded global capital flow routes visualized as bars:
- 🇯🇵 Japan → 🇺🇸 USA ($2.8T carry trade)
- 🇸🇦 Gulf → 🇺🇸 USA (~$600B petrodollar recycling)
- 🇪🇺 Europe → 🇺🇸 USA (~$400B ECB differential play)
- 🇮🇳 India → 🇺🇸 USA ($4.2B FPI outflow)
- 🇨🇳 China → 🥇 Gold (PBOC diversification)

---

### 5. Right Sidebar: Verdict + Risk Radar

Always visible. Shows:
- **Live Verdict**: Top asset (money flowing to) + Bottom asset (capital leaving), derived live from scores
- **By Country**: Flow direction for each country (Receiving / Sending / Outflow / Diverging / Neutral)
- **Risk Radar**: 5 curated risks with HIGH/MED/LOW levels: BoJ hike, US inflation, Rupee (INR 83.6), China PMI, Dollar
- **Playbook shortcut**: Last playbook result with link to full analysis
- **Watch note**: Upcoming calendar events (BoJ Jul 31, RBI Aug)

---

## AI Integration: Claude API

MacroRadar makes **direct browser-to-API calls** to the Anthropic Claude API (`https://api.anthropic.com/v1/messages`) using the `anthropic-dangerous-direct-browser-access: true` header — which bypasses the usual restriction against browser-side API calls.

**Model used:** `claude-sonnet-4-20250514`

**Two AI call types:**

| Call | Trigger | Input | Output |
|---|---|---|---|
| Macro Analyst | "Analyze now" button | Top 6 headlines + asset scores | 4-sentence free-text brief |
| Macro Playbook | Event button click | Event + macro snapshot + asset scores | Structured JSON (regime, assets, India impact, watch, contrarian) |

The API key is currently expected to be embedded or provided — this is a known tradeoff for a browser-only prototype without a backend.

---

## Data: What's Live vs. Hardcoded

| Data Point | Status |
|---|---|
| News headlines | Live (RSS, 2-min refresh) |
| Gold, BTC, INR/USD, JPY/USD prices | Live (Alpha Vantage, 1-min refresh) |
| Asset scores | Computed live from news |
| AI analysis | Live (on-demand, Claude API) |
| CPI / Rate / GDP (macro snapshot) | **Hardcoded** (must be manually updated) |
| Oil, VIX, DXY, US10Y ticker | **Hardcoded** ($84.2, 18.4, 104.2, 4.42%) |
| Flow Map amounts | **Hardcoded** |
| Risk Radar levels | **Hardcoded** |
| Alert thresholds | **Hardcoded** |

---

## Tech Stack

- **Framework:** React 19 (Create React App)
- **Styling:** Inline styles only — no CSS framework, no component library
- **State:** React `useState` + `useEffect` + `useCallback` — no external state management
- **Data fetching:** Native `fetch` API
- **CORS proxy for RSS:** `allorigins.win`
- **Prices API:** Alpha Vantage (free tier, key `ZL792L85HOT616V9` hardcoded in source)
- **AI API:** Anthropic Claude (model: claude-sonnet-4-20250514, direct browser calls)
- **Build tool:** react-scripts (CRA 5.0.1)
- **No backend** — fully client-side

---

## What the Project Is Trying to Become

Based on the branding (`MACRORADAR.IN`) and the India-specific features (INR price, RBI feed, FPI flow tracking, India-specific playbook analysis), this is being built toward a **consumer-facing web product for Indian macro investors**.

The core value proposition:

1. **Passive intelligence**: RSS feeds + scoring engine means the dashboard is always live — no manual curation
2. **AI as analyst**: Claude replaces the expensive human analyst who would otherwise read the news and score asset impacts
3. **Scenario thinking**: The Playbook tab teaches users to think in regimes (RISK-ON/OFF) and event-driven scenarios rather than just tracking prices
4. **India angle**: Every global event gets filtered through "what does this mean for Nifty, INR, and Indian investors?"

---

## Key Gaps / What's Missing (Current State)

1. **No backend** — API key exposed in browser source, no auth, no persistence
2. **Macro snapshot hardcoded** — CPI, rates, GDP not auto-updated; goes stale immediately
3. **Alert system UI-only** — no push notifications, no webhook triggers
4. **Flow Map hardcoded** — not derived from actual data
5. **Risk Radar hardcoded** — not connected to news sentiment
6. **No user accounts** — no way to save custom weights or alert preferences across sessions
7. **Mobile layout missing** — fixed 3-column grid breaks on small screens
8. **No historical data** — scores reset on every page load; no trend view
9. **CORS proxy dependency** — `allorigins.win` is an uncontrolled third-party service
10. **Crypto column thin** — crypto score is just the inverse of dollar score (placeholder logic)

---

## Summary

MacroRadar is a v0.1 prototype of an AI-powered global macro intelligence terminal aimed at Indian investors. It ingests live news, scores each headline's impact on 6 asset classes using heuristics, surfaces a real-time "where is money flowing" verdict, and uses Claude to generate both free-text macro briefs and structured event-scenario analyses. The Macro Playbook — which lets users fire a macro event and get a full AI-reasoned asset reaction — is the core differentiating feature. The project is entirely client-side today with hardcoded macro data, and the natural next step would be a thin backend to secure the API key, auto-update macro variables, and add persistence.
