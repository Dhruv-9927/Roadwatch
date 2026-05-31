# 🛣️ RoadWatch

**AI-powered road safety & accountability platform for India and beyond.**

RoadWatch is a progressive web app (PWA) that lets citizens report road defects, track government spending on road projects, identify dangerous road segments using AI, and file complaints to the correct authority — all from their phone, even offline.

---

## ✨ Features

### 🗺️ Live Map
- Interactive map powered by **MapLibre GL** with real-time overlays for road condition data
- Colour-coded risk heatmap: segments graded from _Low_ to _Critical_ based on AI risk scoring
- Tap any road segment to see its full **Road DNA** — authority info, budget status, maintenance history, and risk score
- Live / Offline status indicator

### 📷 AI Road Scan
- Point your camera at any road surface to detect **potholes, cracks, and patches** in real time
- On-device inference using **ONNX Runtime Web** — no data leaves your device
- Detection results shown with bounding boxes and confidence scores
- One-tap escalation to file a report from within the scan view

### 📋 Report & Route
- Guided citizen reporting flow with photo capture, GPS tagging, severity grading, and voice input
- **Authority Routing Engine** automatically determines the responsible body (NHAI, State PWD, or District Engineer) based on road type (NH / SH / MDR / ODR / VR) following MoRTH classification
- Full reasoning chain shown to the user — transparent, auditable decisions
- Warranty-claim detection: if a road was repaired within its warranty period, the complaint is routed accordingly
- Reports are stored offline-first and synced when connectivity is restored

### 📊 Accountability Dashboard
- District-level transparency scores, budget utilisation rates, accident rates, and resolution rates
- D3-powered charts for at-a-glance comparisons across districts and states
- Direct links to source datasets (data.gov.in, MoRTH) for full transparency

### 🧠 Intelligence View
- XGBoost-inspired **client-side risk scorer** that computes a 0–100 risk score for any road segment based on six explainable features:
  - Years since last relaying (32% weight)
  - Accident density per 100 km (28%)
  - Budget utilisation ratio (15%)
  - Terrain type (12%)
  - Road width / lanes (8%)
  - Traffic volume proxy (5%)
- Top contributing factors surfaced in plain language
- Country dataset explorer for India, Kenya, Nigeria, and Vietnam

### 💬 SafePath AI Chatbot
- Floating AI assistant (powered by **Claude**) available on every screen
- Handles: reporting accidents, finding road info, checking spending, filing complaints, tracking reports
- Voice input support via Web Speech API
- Quick-reply menus for common workflows

### 📡 Offline Mode
- Full offline-first architecture using **Dexie.js** (IndexedDB)
- Tile caching, road data caching, and on-device ONNX model storage
- Cache manager with per-district download controls
- Pending reports queue with automatic background sync

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript 6 |
| Build Tool | Vite 8 |
| Map | MapLibre GL 5 |
| AI Inference | ONNX Runtime Web |
| Charts | D3 7 |
| Offline DB | Dexie 4 (IndexedDB) |
| State | Zustand 5 |
| Chatbot AI | Anthropic Claude API |
| Data Sources | data.gov.in, OSM Overpass, Nominatim |
| Backend / Auth | Supabase |
| Styling | Custom CSS with design tokens |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18 or later
- A free [data.gov.in](https://data.gov.in/user/register) API key
- A free [Supabase](https://supabase.com) project (for report syncing)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-username/roadwatch.git
cd roadwatch

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local and fill in your API keys (see Environment Variables below)

# 4. Start the development server
npm run dev
```

The app will be available at `http://localhost:5173`.

### Build for Production

```bash
npm run build
npm run preview   # preview the production build locally
```

---

## 🔑 Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

```env
# data.gov.in — free at https://data.gov.in/user/register
VITE_DATA_GOV_API_KEY=your_data_gov_in_api_key_here

# Supabase — free at https://supabase.com
VITE_SUPABASE_URL=your_supabase_project_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# OSM Overpass (public, no key needed)
VITE_OVERPASS_API=https://overpass-api.de/api/interpreter

# Nominatim geocoding (public, no key needed)
VITE_NOMINATIM_API=https://nominatim.openstreetmap.org
```

> **Note:** The Overpass and Nominatim endpoints are free public services — no registration required.

---

## 📁 Project Structure

```
roadwatch/
├── public/
│   ├── favicon.svg
│   ├── icons.svg
│   └── manifest.json           # PWA manifest
├── src/
│   ├── components/
│   │   ├── accountability/     # Budget & transparency dashboard
│   │   ├── chatbot/            # SafePath AI chatbot (engine, store, types, voice)
│   │   ├── intelligence/       # Risk scoring & country datasets view
│   │   ├── map/                # Live map view
│   │   ├── offline/            # Offline cache manager
│   │   ├── report/             # Citizen report flow + voice reporting
│   │   ├── scan/               # AI road scan (ONNX)
│   │   ├── scatter/            # Splash screen
│   │   └── shared/             # NavBar and shared UI
│   ├── lib/
│   │   ├── data-join.ts        # Joins OSM + gov data into Road DNA
│   │   ├── live-data.ts        # API calls to Overpass, data.gov.in, Supabase
│   │   ├── offline-db.ts       # Dexie schema & offline-first DB layer
│   │   ├── risk-scorer.ts      # XGBoost-inspired client-side risk scorer
│   │   └── routing-engine.ts   # Authority routing logic (MoRTH classification)
│   ├── store/
│   │   └── app.store.ts        # Zustand global state
│   ├── styles/
│   │   ├── tokens.css          # Design tokens (colours, spacing, typography)
│   │   ├── base.css            # Reset & base styles
│   │   └── animations.css      # Reusable animation utilities
│   ├── types/
│   │   └── index.ts            # Shared TypeScript types (single source of truth)
│   ├── App.tsx
│   └── main.tsx
├── .env.example
├── package.json
└── vite.config.ts
```

---

## 🤖 How the Authority Routing Engine Works

The routing engine is a pure TypeScript module — no side effects, fully deterministic. It takes a **Road DNA** object and returns a **RoutingDecision** with a full reasoning chain:

1. **Road Type Check** — NH roads go to the relevant NHAI PIU; SH roads go to State PWD; MDR/ODR/VR roads go to the District Engineer.
2. **Warranty Check** — If `maintenance.warranty_active` is `true`, the complaint type becomes `warranty_claim` and the contractor is CC'd.
3. **Budget Check** — Significant underspend triggers a `budget_discrepancy` flag.
4. **Confidence Score** — Based on data completeness, a 0–1 confidence value is computed so citizens know how reliable the routing is.

Every step is logged as a `ReasoningStep` and shown to the user, making the system fully auditable.

---

## 📱 PWA Support

RoadWatch is a fully installable Progressive Web App:

- Add to Home Screen on iOS and Android
- Works offline after first load
- Background sync for queued reports
- App manifest with proper icons and display mode

---

## 🌍 Country Support

The Intelligence view currently includes datasets for:

| Country | Flag | Road Count | Coverage |
|---|---|---|---|
| India | 🇮🇳 | ~6.3 million km | National + State highways |
| Kenya | 🇰🇪 | ~177,000 km | National + County roads |
| Nigeria | 🇳🇬 | ~200,000 km | Federal + State roads |
| Vietnam | 🇻🇳 | ~570,000 km | National + Provincial |

---

## 🧪 Scripts

```bash
npm run dev       # Start development server with HMR
npm run build     # Type-check and build for production
npm run preview   # Preview production build locally
npm run lint      # Run ESLint
```

---

## 📄 License

This project is open source. See [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgements

- Road condition data sourced from [data.gov.in](https://data.gov.in) and [MoRTH](https://morth.nic.in)
- Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors
- Geocoding by [Nominatim](https://nominatim.org)
- AI assistant powered by [Anthropic Claude](https://www.anthropic.com)
