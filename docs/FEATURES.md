# JeneBosi (WebGIS2MBC) — Complete Feature Inventory

Every feature the program contains, with **implementation location** and **honest status**.
Status legend:

| Mark | Meaning |
|---|---|
| ✅ | Working and reachable in the UI |
| ⚠️ | Working but with a documented caveat (data incomplete, synthetic, static, or approximate) |
| 🚫 | **Present in the code but unreachable** — no control ever triggers it |
| ❌ | **Not implemented** (listed so you don't accidentally claim it) |

Verified against commit `a74b128` (branch `arena/f7a2264e-webgis2`).

---

## 0. Summary

| Category | ✅ Working | ⚠️ With caveat | 🚫 Unreachable |
|---|---|---|---|
| Map & visualisation | 8 | 1 | 3 |
| Kelurahan detail & citizen action | 8 | 1 | 0 |
| Weather / forecast | 2 | 1 | 0 |
| Tide & marine | 3 | 1 | 0 |
| Evacuation & routing | 5 | 1 | 0 |
| Critical facilities | 4 | 0 | 0 |
| Canal setback analysis | 0 | 0 | 2 |
| Scenario simulation | 4 | 1 | 0 |
| Water-height simulator | 1 | 1 | 1 |
| Guidance & education | 3 | 0 | 1 |
| Application shell & UX | 7 | 0 | 0 |
| Backend / API | 10 | 2 | 0 |
| ETL & data tooling | 5 | 2 | 1 |
| **Total** | **60** | **11** | **9** |

One-line summary for a slide:
> **60 working features, 11 working with documented caveats, 9 present but not wired into the UI.**

---

## 1. Map and visualisation

| # | Feature | Status | Implementation | Notes |
|---|---|---|---|---|
| 1.1 | Full-screen Leaflet map, Makassar centred at −5.1477, 119.4327, zoom 12 | ✅ | `FloodMap.jsx` `<MapContainer>` | map fills the viewport; `100dvh` on mobile |
| 1.2 | Dark cartographic basemap (Esri World Dark Gray Base + Reference label tiles) | ✅ | `BASEMAPS.darkgray` | chosen so the risk choropleth is the visual figure rather than roads |
| 1.3 | Choropleth of **153 kelurahan** polygons coloured by 5 classes (Aman / Waspada / Siaga / Bahaya / no-data) | ✅ | `featureStyle()` + `RISK_COLORS` | fill opacity 0.65 default |
| 1.4 | Selected polygon highlight (teal `#176B65` 3.5 px border, higher fill opacity) | ✅ | `featureStyle()` | |
| 1.5 | Hover tooltip: colour dot + kelurahan name + risk class | ✅ | `onEachFeature()` → `bindTooltip` (sticky) | tooltip unbinds on click so it doesn't linger |
| 1.6 | Hover emphasis (border thickens to 2.5 px, turns teal) | ✅ | `mouseover`/`mouseout` | suppressed for the selected polygon |
| 1.7 | Click-to-select polygon → camera flies/fits to its bounds (maxZoom 15, 60 px padding) | ✅ | `SelectedFocus` (`useMap` + `fitBounds`) | |
| 1.8 | Legend: four risk colours with **live counts** + marker symbols, collapsible | ✅ | `FloodRiskLegend.jsx` | starts collapsed on screens ≤ 768 px |
| 1.9 | Free-text search over kelurahan names (filters the polygons themselves) | ✅ | `AppHeader` autocomplete (≤ 8 results, ≥ 2 chars) + mobile autocomplete (≤ 6) → `filteredGeojson` | filtering **hides** non-matching polygons |
| 1.10 | Category filter chips: Semua / Aman / Waspada / Siaga / Bahaya with counts | ✅ | `AppHeader` + `App.summary` | same classifier as the map, except in simulation mode (see §11 caveats) |
| 1.11 | "Lokasi saya" — browser geolocation, blue GPS dot, fly to zoom 14 | ✅ | `handleDetectLocation` + `UserLocationFocus` | 10 s timeout, high accuracy; failure toast |
| 1.12 | "Reset peta" — camera returns to city extent; doubles as "Reset rute" when a route is drawn | ✅ | `MapResetFocus` + `resetCount` | |
| 1.13 | Map resize handling (`invalidateSize` on resize + 150/500 ms after mount) | ✅ | `MapResizeHandler` | fixes the classic Leaflet-in-flexbox grey-tile bug |
| 1.14 | Toast notifications (bottom pill, 3.5 s) | ✅ | `toastMsg` in `FloodMap` | GPS, reset, buffer messages |
| 1.15 | Layer opacity control | 🚫 | `layerOpacity` state exists (0.65) | **no UI ever calls `setLayerOpacity`** — `IconOpacity` is imported but unused |
| 1.16 | Waterway layer (6 rivers/canals with tooltips + click-to-analyse) | 🚫 | `showKanal` + `KANAL_DAN_SUNGAI_MAKASSAR` | `setShowKanal(true)` is never called → layer can never appear |
| 1.17 | Split-screen compare: satellite imagery vs risk overlay with draggable divider | 🚫 | `compareMode`, `MapCompareController` (creates a clipped `rightBasemapPane`), divider UI, badges, CSS | `setCompareMode(true)` is never called → whole feature dead. One toolbar button would revive it. |
| 1.18 | Multiple basemaps / layer switcher | ❌ | `BASEMAPS` holds one entry | `IconLayers` imported but unused |

---

## 2. Kelurahan detail panel and citizen actions

### 2.1 Desktop panel — `SelectedAreaPanel.jsx`

| # | Feature | Status | Notes |
|---|---|---|---|
| 2.1 | Floating detail panel on polygon click, with close button | ✅ | top-right overlay, escapes on close |
| 2.2 | Header: eyebrow "KELURAHAN TERPILIH", name, kecamatan | ✅ | `kecamatan` is empty for map-click selections (no endpoint supplies it) |
| 2.3 | Risk hero badge — 5 states with colour, label and description | ✅ | `getRiskBadge()`: Bahaya Ekstrem / Siaga Banjir / Waspada / Aman / Data Belum Tersedia |
| 2.4 | Tab "Ikhtisar": depth card + "Apa Artinya bagi Saya?" + action recommendations | ✅ | generated text, never hard-coded risk claims |
| 2.5 | Tab "Prakiraan Cuaca": up to 8 forecast cards with time/date/emoji/temp/humidity | ⚠️ | renders only if `prakiraan_bmkg` has rows — BMKG ingestion is not wired (§12.1) |
| 2.6 | Forecast states: loading spinner text, error with "Coba lagi", empty with "Perbarui prakiraan" | ✅ | `forecastRequestVersion` bump-to-refetch |
| 2.7 | Forecast disclaimer ("prakiraan, bukan observasi") | ✅ | explicit integrity note in-panel |
| 2.8 | Citizen action hub (expandable): route / call 112 / share / report / save / nearest shelter | ✅ | `CitizenActionHub.jsx` |

### 2.2 Mobile bottom sheet — `MobileBottomSheet.jsx`

| # | Feature | Status | Notes |
|---|---|---|---|
| 2.9 | Three-position sheet (`peek → half → expanded`) cycled by tapping the handle | ✅ | tap-cycle, not real drag gestures |
| 2.10 | Three tabs: Ikhtisar / Ketinggian Air / Cuaca BMKG | ✅ | |
| 2.11 | "Coba Simulator Ketinggian Air" + "Simulasi" buttons → open the simulator modal | ✅ | this is the only route to `FloodDepthSimulator` |

### 2.3 Citizen actions (`CitizenActionHub.jsx`)

| # | Feature | Status | Notes |
|---|---|---|---|
| 2.12 | "Simpan kelurahan ini" — persisted in `localStorage["webgis2mbc_saved_kelurahan"]` | ✅ | dedup via `Set`, `try/catch` for private mode |
| 2.13 | "Bagikan status" — `navigator.share()` with WhatsApp deep-link fallback | ✅ | swallows `AbortError` |
| 2.14 | "Lapor genangan" — 4 water-level options → builds a report message → share sheet | ⚠️ | **nothing is sent to the server**; the UI says a human must forward it |
| 2.15 | "Hubungi 112" and "Rute ke posko" shortcuts | ✅ | `tel:112`; shelter chosen by matching kecamatan |
| 2.16 | Nearest-shelter card (name + address) | ⚠️ | *jurisdictional* match on kecamatan string, not geometric distance |

### 2.4 Depth visualisation

| # | Feature | Status | Notes |
|---|---|---|---|
| 2.17 | Depth estimate card: cm + metres + water-column bar + impact band | ✅ | `FloodDepthEstimate.jsx` |
| 2.18 | Human-scale SVG: adult 170 cm, child 110 cm, 1.25 px/cm scale, 0–200 cm ruler, water gradient | ✅ | `FloodDepthVisualization.jsx` (454 lines) |
| 2.19 | 6-band impact classification with 4 entities each (pedestrian / child / motorcycle / car) + advice | ✅ | thresholds 0/15/35/60/100 cm |
| 2.20 | Last-updated timestamp + weather condition line | ✅ | localised `id-ID` |

---

## 3. Weather and forecast

| # | Feature | Status | Implementation |
|---|---|---|---|
| 3.1 | BMKG forecast panel with 8-slot interactive timeline (3-hourly) | ⚠️ | `RainfallInsight.jsx` — needs stored forecast rows |
| 3.2 | Current/selected highlight card: condition emoji, temperature, humidity, location tag | ✅ | same |
| 3.3 | BMKG rainfall-threshold reference cards (Ringan 0.5–20 / Sedang 20–50 / Lebat 50–100 / Sangat lebat >100 mm/day) | ✅ | static reference content |
| 3.4 | Data-integrity note (forecast ≠ observation) | ✅ | |
| 3.5 | "Status hujan hari ini" reading | 🚫 | `hujanTerbaru={0}` hard-coded at both call sites → **always reads "0 mm (Kering)"** |
| 3.6 | Forecast request cancellation on re-selection (`AbortController`) | ✅ | prevents stale-response races |
| 3.7 | Two-endpoint fallback (`/api/bmkg/prakiraan/*` then `/api/prakiraan/*`) | ✅ | tolerates older deployments |
| 3.8 | Tolerant field normalisation (accepts our envelope, `data.prakiraan`, raw BMKG `cuaca[][]`, or a bare array) | ✅ | `normalisasiPrakiraan()` — the seam for a future direct BMKG call |

---

## 4. Tide and marine (rob)

| # | Feature | Status | Implementation |
|---|---|---|---|
| 4.1 | Live marine data: wave height, wave period, current velocity (Open-Meteo Marine) | ✅ | `GET /api/maritim/pasut` → `TideMonitorWidget.jsx` |
| 4.2 | Tide height + total elevation | ⚠️ | **synthetic M2 harmonic model** `0.9 + 0.65·cos(2πt/12.42) + 0.1·H_wave`, not measured |
| 4.3 | Three-state rob status (normal / waspada ≥1.10 m / ekstrem ≥1.40 m) with colour + description | ✅ | thresholds are operational-looking but not calibrated |
| 4.4 | 4-slot daily schedule ("Pasang Pertama / Surut Pagi / Pasang Siang / Surut Malam") | ⚠️ | hours are hard-coded labels; only heights come from the cosine |
| 4.5 | Four oceanographic metric cards (wave, current, period, astronomical elevation) | ✅ | |
| 4.6 | Coastal kelurahan list prone to rob (6 entries) + "Sorot di Peta" shortcut | ✅ | shortcut sets `search = "Mariso"` (a filter, not a multi-highlight) |
| 4.7 | Compound-flood explainer (rain + high tide → closed floodgates → slower recession) | ✅ | static educational content |
| 4.8 | 5-minute auto-poll + manual refresh button | ✅ | interval cleared on unmount |
| 4.9 | Offline fallback so the widget never errors | ⚠️ | backend *and* client both return hard-coded "calm" numbers with HTTP 200 |

---

## 5. Evacuation and routing

| # | Feature | Status | Implementation |
|---|---|---|---|
| 5.1 | 12 official-style shelter (posko) markers with category-specific icons | ✅ | `POSKO_EVAKUASI_MAKASSAR` + `createPoskoIcon()` |
| 5.2 | Rich shelter popup: category chip, status, address, capacity, contact | ✅ | |
| 5.3 | Popup actions: "Rute Google Maps" deep link + `tel:112` | ✅ | real external navigation |
| 5.4 | "Fokus ke Posko" — camera flies to zoom 16 | ✅ | `PoskoFocus` |
| 5.5 | Evacuation route generation: distance, car time, walking time, 4 waypoints, advisories | ⚠️ | `generateJalurEvakuasi()` — Haversine × 1.3 detour, 25 km/h car, 4 km/h walk; **waypoints are interpolated, not road-following** |
| 5.6 | Route rendering: dashed emerald polyline + "📍 Mulai" / "⛺ Posko Aman" pins | ✅ | |
| 5.7 | Route card with origin/target, 3 metrics, safety advisories, Maps link, `tel:` to the shelter | ✅ | `EvacuationRouteCard.jsx`; eyebrow switches to "SKENARIO EVAKUASI SIMULASI" in simulation mode |
| 5.8 | Scenario-aware advisory ("avoid canal bridges during peak discharge") when rain > 60 mm or tide > 1.25 m | ✅ | prepended to the advisory list |
| 5.9 | Route to a critical facility from its popup | ✅ | `handleStartRouteToFacility()` |
| 5.10 | Route cleanup: "Reset rute" clears polyline + card | ✅ | |
| 5.11 | Road-network routing / shortest safe path / turn-by-turn | ❌ | no routing engine; Google Maps deep link is the real router |

---

## 6. Critical facilities

| # | Feature | Status | Notes |
|---|---|---|---|
| 6.1 | 12 facilities in 4 categories (4 health, 3 command, 3 worship, 2 fuel) | ✅ | `fasilitasKritis.js` |
| 6.2 | Category filter (Semua / RS & Puskesmas / BPBD & Damkar / Ibadah / SPBU) + "hide all" | ✅ | sidebar drawer + mobile modal |
| 6.3 | Category-coloured emoji markers | ✅ | `createFacilityIcon()` |
| 6.4 | Facility popup: category label, name, address, elevation, capacity, contact, services (first 3) | ✅ | |
| 6.5 | Popup actions: "Rute Evakuasi ke Sini" + Maps deep link | ✅ | |

---

## 7. Canal setback (sempadan) analysis

| # | Feature | Status | Notes |
|---|---|---|---|
| 7.1 | Setback corridor geometry computed in degrees with a local metric (per-segment m/° from latitude) | 🚫 | `buildRiverBufferGeoJson()` is complete and correct-ish — but nothing can turn it on |
| 7.2 | Waterway picker, 100/250/500 m radius chips, affected-kelurahan list, disclaimer | 🚫 | `RiverBufferTool.jsx` renders only when `bufferToolOpen` — which only the (dead) waterway layer click can set |
| 7.3 | Radius-dependent affected-kelurahan list | ❌ | the list is **static per river**; counts do not change with the radius |
| 7.4 | True geometric buffer / dissolve / legal floodplain | ❌ | quads per segment, overlapping, labelled "zona indikatif" |

**Fix for 7.1–7.2 (one line each):** add a sidebar item with `id: "kanal_buffer"` to `SIDEBAR_ITEMS` — the drawer title and the `bufferToolOpen={bufferToolOpen || activeSidebarMenu === "kanal_buffer"}` wiring already exist.

---

## 8. Scenario simulation ("Mode Simulasi")

| # | Feature | Status | Notes |
|---|---|---|---|
| 8.1 | Real-time ↔ simulation mode switch | ✅ | `isSimulation`; "Mode 1: Real-Time Live" / "Mode 2: Simulasi Pengujian Kustom" |
| 8.2 | 4 presets: Normal/Kemarau · Hujan Monsun Lebat · Puncak Pasang Rob · Banjir Majemuk Katastrofik | ✅ | `PRESET_SKENARIO` |
| 8.3 | Custom sliders: rain 0–180 mm (step 5) · tide 0.30–1.80 m (step 0.05) · buffer 50–800 m (step 50) | ⚠️ | the buffer slider is **not consumed** (radius comes from separate state) |
| 8.4 | Live reclassification of all 153 polygons + count recalculation | ✅ | `getFeatureRisk` simulation branch |
| 8.5 | Scenario banner over the map (rain, tide, scenario name + "Atur Parameter" / "Reset Real-Time") | ✅ | |
| 8.6 | One-click reset to real-time data | ✅ | restores the normal preset |
| 8.7 | Simulated depth shown in the detail panel and depth card | ⚠️ | dry-day preset still reports 5–25 cm (static term is unconditional) |
| 8.8 | Persistent/auditable scenario results | ❌ | purely client-side, never stored |

---

## 9. Water-height simulator

| # | Feature | Status | Notes |
|---|---|---|---|
| 9.1 | Auto mode: follows the kelurahan selected on the map, uses curated depth priors (Antang 85 / Camba Berua 65 / Mariso 50 cm, else 75/45/20/0 by class) | ✅ | reachable **only on mobile** (bottom sheet / chip) |
| 9.2 | Custom mode: 0–200 cm slider + 6 presets (0 / 15 / 35 / 60 / 100 / 150 cm) | ✅ | |
| 9.3 | Live human-scale visualisation for the chosen depth | ✅ | reuses `FloodDepthVisualization` |
| 9.4 | Quick-pick buttons when nothing is selected (Antang, Mariso, Tallo, Panakkukang) | ✅ | |
| 9.5 | Desktop access | 🚫 | `WaterHeightSimulatorModal` is wired to `waterSimulatorOpen`, whose setter is **never called**; the `simulator_air` sidebar id has a title but no drawer body |
| 9.6 | Sensor-based real depth (`kedalaman_air_cm`) | ❌ | the code already prefers this field — no endpoint supplies it (AWLR hook) |

---

## 10. Guidance, education, about

| # | Feature | Status | Notes |
|---|---|---|---|
| 10.1 | 3-phase emergency guide (before the rain / water rising / evacuation), 3 steps each, each with an explicit action | ✅ | `CitizenSafetyGuide.jsx` |
| 10.2 | Emergency CTA row: `tel:112` + pre-filled BPBD WhatsApp deep link | ✅ | |
| 10.3 | Preparedness checklist: 13 items × 3 categories with progress bar, colour-coded at 50/100 %, reset with confirmation | ✅ | persisted in `localStorage["webgis2mbc_checklist_state"]` |
| 10.4 | Checklist accessibility: `role="checkbox"`, `aria-checked`, `tabIndex`, Enter/Space | ✅ | |
| 10.5 | Data-source & methodology page: 4 source cards, risk-class definition table, limitations/disclaimer, author credits | ✅ | `DataSourceInfo.jsx` |
| 10.6 | Landing/hero section with headline + stat pills + scroll-to-map CTA | 🚫 | `IntroSection.jsx` is never imported (leftover from the pre-map layout) |

---

## 11. Application shell and UX

| # | Feature | Status | Notes |
|---|---|---|---|
| 11.1 | Dark/light theme toggle, persisted in `localStorage["jenebosi_theme"]` | ✅ | one `data-theme` attribute on `<html>`; 52 CSS variables |
| 11.2 | Dual layout: laptop dashboard (floating header + icon rail + drawer) and mobile (top island + chip rail + bottom sheet + modals) | ✅ | two complete JSX trees |
| 11.3 | Automatic layout switching with hysteresis (< 640 px → mobile, ≥ 1024 px → laptop) and 200 ms debounce | ✅ | avoids layout thrash |
| 11.4 | Manual layout toggle ("Laptop" / "HP") | ✅ | |
| 11.5 | Docked sidebar icon rail with collapse/expand | ✅ | 8 menu items, icon-only by default |
| 11.6 | Sidebar feature drawer with 8 panel bodies (ikhtisar, posko, fasilitas, cuaca, pasut, simulasi, panduan, tentang) | ✅ | |
| 11.7 | Mobile chip rail (13 chips: counts, simulation, tide, weather, shelters, facilities, 112, guide, about) | ✅ | |
| 11.8 | Modal system: generic mobile drawer modal, simulation controller, water simulator | ✅ | overlay click closes; content click does not |
| 11.9 | Hide the kelurahan panel when a sidebar menu is opened (and vice versa) | ✅ | prevents overlapping panels |
| 11.10 | Focus trap / Escape-to-close in modals | ❌ | `role="dialog"` and `aria-modal` are set, but focus is not trapped |
| 11.11 | Pinch-zoom on mobile | ❌ | viewport meta sets `user-scalable=no` |
| 11.12 | PWA: installable manifest + service worker / offline mode | ❌ | only the `mobile-web-app-capable` meta tags exist |

---

## 12. Backend features

| # | Feature | Status | Endpoint / file |
|---|---|---|---|
| 12.1 | GeoJSON of all 153 kelurahan (3 properties, `ST_AsGeoJSON`) | ✅ | `GET /api/kelurahan/geojson` |
| 12.2 | Risk rows for every kelurahan (11 fields incl. index + depth + BMKG condition) | ✅ | `GET /api/banjir` |
| 12.3 | BMKG forecast rows with a 6-hour window and a "most recent" fallback | ⚠️ | `GET /api/bmkg/prakiraan/{kode}` + alias `/api/prakiraan/{kode}` — fallback is sorted DESC (renders backwards) |
| 12.4 | Marine/tide payload transformed into the widget's exact contract | ⚠️ | `GET /api/maritim/pasut` — tensor is synthetic; errors return 200 + hard-coded values |
| 12.5 | Health check (database name, PostGIS version, kelurahan count; 503 on failure) | ✅ | `GET /api/health` |
| 12.6 | ETL status reporting | ⚠️ | `GET /api/sync-status` — process-local dict, unreliable on serverless |
| 12.7 | Server-side kelurahan search | ✅ (unused) | `GET /api/kelurahan?q=` — the client filters locally instead |
| 12.8 | Latest rainfall for one kelurahan | ⚠️ (unused) | `GET /api/kelurahan/{id}/hujan-terbaru` — a deliberate 404 comes back as 500 |
| 12.9 | Daily automated sync: batched Open-Meteo fetch → rainfall insert → risk upsert | ✅ | `GET /api/cron/sync-weather`, cron `0 0 * * *` |
| 12.10 | Weighted risk model as a pure, validated function module | ✅ | `services/flood_risk_model.py` (raises if any score ∉ 1..5) |
| 12.11 | Multi-origin CORS (env list + `https://*.vercel.app` regex) | ✅ | `main.py` — permissive regex |
| 12.12 | SPA serving from the backend | ⚠️ | `GET /` returns `index.html` but `/assets` is never mounted → broken in the Docker path |
| 12.13 | Serverless entry shim (`sys.path` fix) | ✅ | `api/index.py` |
| 12.14 | Authentication / API keys / rate limiting | ❌ | none; even the cron endpoint is open |
| 12.15 | Response caching (ETag / Cache-Control) | ❌ | none — 780 KB re-serialised per request |
| 12.16 | Typed response schemas (Pydantic models) | ❌ | all handlers return raw dicts |
| 12.17 | Compression middleware | ❌ | none (gzip would cut 780 KB → 245 KB) |

---

## 13. ETL and data tooling

| # | Tool | Status | Purpose |
|---|---|---|---|
| 13.1 | `download_batas.py` | ⚠️ | fetches 153 polygons from BIG/BAPANAS ArcGIS — **hard-coded `E:\webgis2mbc\...` path** |
| 13.2 | `import_kelurahan.py` | ✅ | GeoJSON → staging → PostGIS with CRS check, `make_valid`, `ST_Multi`/`Force2D`/`CollectionExtract`, idempotent upsert |
| 13.3 | `hitung_elevasi_api.py` | ✅ | elevation via Open-Meteo at `ST_PointOnSurface`, batched 100, upsert |
| 13.4 | `hitung_elevasi.py` (zonal statistics from a local DEM) | ⚠️ | correct implementation, but writes a CSV that **nothing loads**; needs `rasterio`/`rasterstats` (not in requirements.txt) |
| 13.5 | `init_bmkg_table.py` | ⚠️ | creates `prakiraan_bmkg` but without the unique constraint / `diambil_pada` column the sync script needs |
| 13.6 | `sync_prakiraan_bmkg.py` | 🚫 | **circular** (calls our own API instead of BMKG) and would fail on the missing constraint/column |
| 13.7 | `inspect_geo.py`, `test_db.py` | ✅ | debug helpers (CRS/columns/geometry types; DB + PostGIS connectivity) |
| 13.8 | `data/curah_hujan.csv` | ✅ | 5-line **import template**, not real data |

---

## 14. Data assets shipped

| Asset | Count | Source / note |
|---|---|---|
| Kelurahan polygons | **153** (163 polygons, 27 130 vertices) | BIG / BAPANAS, EPSG:4326, 15 kecamatan |
| Shelter (posko) records | 12 | curated, header cites BPBD & Dinas Sosial |
| Critical facilities | 12 (4 health · 3 command · 3 worship · 2 fuel) | curated |
| Waterways (rivers + canals) | 6 | schematic centrelines, 6–7 vertices each |
| Rob-prone coastal kelurahan | 6 | curated list inside the tide widget |
| Curated depth priors | 5 name rules + 4 class rules | inside `FloodDepthSimulator` |
| Coastal / basin name lists | 7 + 5 names | inside `App.jsx` and `FloodMap.jsx` (duplicated) |
| BMKG sample payload | 1 file | `backend/bmkg_test.json`, Kelurahan Antang, 2026-10-16 |
| Icon set | 43 inline SVG icons | `Icons.jsx`, zero icon dependency |

---

## 15. The 9 unreachable features — and the fix for each

| # | Feature | Why it is unreachable | Fix |
|---|---|---|---|
| 1 | Split-screen compare | `setCompareMode(true)` never called | add a toolbar button that toggles it |
| 2 | Waterway layer | `setShowKanal(true)` never called | add a toggle (the layer code is complete) |
| 3 | Canal setback corridor on the map | requires the waterway click or `bufferToolOpen` | see #4 |
| 4 | `RiverBufferTool` card + radius chips | `bufferToolOpen` is only set inside the dead waterway click | add a `kanal_buffer` sidebar item to `SIDEBAR_ITEMS` (title + wiring already exist) |
| 5 | Desktop water-height simulator modal | `setWaterSimulatorOpen(true)` never called | wire it to the `simulator_air` sidebar id, or render `FloodDepthSimulator` in that drawer body |
| 6 | Layer opacity control | no slider calls `setLayerOpacity` | add a slider (state already flows into the style) |
| 7 | "Today's rain" reading | hard-coded `hujanTerbaru={0}` | pass the real value (endpoint §12.8 already exists) |
| 8 | Hero/intro section | `IntroSection.jsx` never imported | either mount it above the map or delete it |
| 9 | BMKG forecast ingestion | circular sync script | write a real `api.bmkg.go.id` client (adapter already parses the shape) |

---

## 16. Features explicitly NOT in the program (do not claim these)

| Missing | Why it matters |
|---|---|
| Hydrodynamic / 2D flood simulation | the whole depth model is a surrogate |
| Real-time water-level sensors (AWLR) | no sensor data anywhere in the stack |
| Live BMKG API ingestion | scaffolded, not wired |
| Road-network routing | routing is Haversine × 1.3 with interpolated waypoints |
| Real geometric buffers / legal floodplain | corridor quads, "indicative" only |
| Historical flood time series / trend charts | `curah_hujan` stores history but no UI reads more than the latest row |
| User accounts, saved preferences on the server, report submission | only browser `localStorage` |
| Push notifications / SMS / WhatsApp alerts (outbound) | only share-sheet and deep links |
| Admin/CMS for shelters, facilities or scores | data lives in JS files and SQL |
| Data export (GeoJSON/CSV/PDF download) | not implemented |
| Multi-language (EN) | Indonesian only |
| PWA install / offline cache | meta tags only, no manifest or service worker |
| Automated tests / CI | none |
| Analytics / usage logging | none |

---

## 17. Feature map per screen (for a demo)

**Laptop layout**
- *Glass header*: brand, search + autocomplete, theme toggle, layout toggle, 5 filter chips with counts.
- *Icon rail (left)*: 8 menu items + collapse.
- *Drawer*: ringkasan + quick-pick pills · 12 shelter cards with focus/route · facility categories · weather · tide · simulation launcher · guide + checklist · data sources.
- *Map*: choropleth, tooltips, GPS, reset, legend, simulation banner, route card, toasts.
- *Floating panel*: kelurahan detail with 2 tabs + citizen actions + depth figure.
- *Modals*: simulation controller.

**Mobile layout**
- *Top island*: brand, search + autocomplete, theme, "Laptop" switch.
- *Chip rail (13)*: 5 count filters · Simulasi · Pasang Surut · Cuaca BMKG · Posko · Fasilitas · Darurat 112 · Panduan Siaga · Tentang Data.
- *Map*: same engine, including the simulator access via the bottom sheet.
- *Bottom sheet*: 3 snap states × 3 tabs + citizen actions + simulator launcher.
- *Modals*: shelters, 112 guide, facility filter, depth simulator, checklist, weather, tide, data sources.
