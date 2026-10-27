# JeneBosi (WebGIS2MBC) — Complete Code Walkthrough

> A line-by-line, file-by-file explanation of the **backend** (FastAPI + PostGIS) and the **frontend** (React 19 + Leaflet) of this repository.
> Written from a full read of every source file at commit `a81fd4d` ("updating main").
> Code identifiers and user-facing strings are in Indonesian; this document is in English with the Indonesian terms preserved and glossed.

---

## Table of contents

1. [What this application is](#1-what-this-application-is)
2. [Repository inventory](#2-repository-inventory)
3. [Runtime architecture and request lifecycle](#3-runtime-architecture-and-request-lifecycle)
4. [Build, deployment and configuration](#4-build-deployment-and-configuration)
5. [Backend deep dive](#5-backend-deep-dive)
   - 5.1 [`backend/app/database.py`](#51-backendappdatabasepy)
   - 5.2 [`backend/app/main.py`](#52-backendappmainpy) — every endpoint
   - 5.3 [`backend/app/services/flood_risk_model.py`](#53-backendappservicesflood_risk_modelpy)
   - 5.4 [`backend/app/services/rain_sync.py`](#54-backendappservicesrain_syncpy)
   - 5.5 [`backend/api/index.py`](#55-backendapiindexpy)
   - 5.6 [One-shot ETL / utility scripts](#56-one-shot-etl--utility-scripts)
   - 5.7 [SQL migration and the inferred database schema](#57-sql-migration-and-the-inferred-database-schema)
6. [Frontend deep dive](#6-frontend-deep-dive)
   - 6.1 [Entry points and build config](#61-entry-points-and-build-config)
   - 6.2 [`App.jsx` — the application shell](#62-appjsx--the-application-shell)
   - 6.3 [Components, one by one](#63-components-one-by-one)
   - 6.4 [Static data modules](#64-static-data-modules)
   - 6.5 [The routing utility](#65-the-routing-utility)
   - 6.6 [Styling system](#66-styling-system)
7. [End-to-end interaction flows](#7-end-to-end-interaction-flows)
8. [Data contract matrix (backend ↔ frontend)](#8-data-contract-matrix-backend--frontend)
9. [Bugs, inconsistencies, dead code and risks](#9-bugs-inconsistencies-dead-code-and-risks)
10. [How to run it locally, and how to extend it](#10-how-to-run-it-locally-and-how-to-extend-it)
11. [Glossary](#11-glossary)

---

## 1. What this application is

**JeneBosi (JB)** — "Jene'" = water, "Bosi" = rain in Makassarese — is a public-facing **WebGIS flood-risk and evacuation dashboard for Kota Makassar, Sulawesi Selatan, Indonesia**. Version `1.3.0`.

It is a two-part system:

| Part | Stack | Role |
|---|---|---|
| `backend/` | Python 3.12, FastAPI, SQLAlchemy Core (raw `text()` SQL), PostgreSQL + **PostGIS** (Supabase), `httpx` | Owns the geospatial truth: 153 kelurahan polygons, elevation, rainfall, flood-risk scores; proxies Open-Meteo (weather + marine) |
| `frontend/` | React 19, Vite 8, `react-leaflet` 5 / Leaflet 1.9, hand-written CSS (7 075 lines) | Renders a full-screen dark "cartographic" map, risk choropleth, weather/tide widgets, evacuation routing, a scenario simulator, and citizen-safety content |

The product intent is spelled out in the UI copy itself: it is a **preparedness and education tool**, *not* a real-time sensor early-warning system. Several components (`DataSourceInfo.jsx`, `PreparednessChecklist.jsx`, `RiverBufferTool.jsx`) deliberately print disclaimers to that effect — the authors went out of their way to avoid over-claiming. You will see this "honesty" theme repeatedly in the code comments.

Key user-visible features:

- Choropleth of 153 kelurahan coloured by flood-risk level (Aman / Waspada / Siaga / Bahaya).
- Click a polygon → detail panel: risk badge, estimated inundation depth (with a human-scale SVG illustration), BMKG forecast cards, "what does this mean for me", and citizen action buttons (call 112, share, save area, report flooding).
- **Scenario simulator** ("Mode Simulasi") — override rainfall / tide / canal buffer and recolour the whole map.
- **Evacuation routing** to 12 posko (shelters) or 12 critical facilities, with distance/time/advisories.
- **Tide (pasang-surut / rob) monitor** fed by Open-Meteo Marine plus an M2 harmonic model.
- **Canal buffer tool** — builds an indicative riverbank setback corridor in metres.
- **Split-screen compare** of satellite imagery vs. risk overlay (implemented but currently unreachable, see §9).
- Dual layout: a laptop dashboard and a separate mobile layout with a draggable bottom sheet.
- Dark/light theme persisted in `localStorage`.

---

## 2. Repository inventory

```
WebGIS2/
├── Dockerfile                 multi-stage build: Vite build → copy dist into Python image
├── vercel.json                (legacy/broken) monorepo Vercel config
├── package-lock.json          89-byte stub, no dependencies
├── .vscode/settings.json      points interpreter at backend/.venv/Scripts/python.exe (Windows path)
├── data/
│   ├── batas_kelurahan/kelurahan.geojson   1.3 MB, 153 features, BIG/BAPANAS boundaries
│   └── curah_hujan.csv                     5-line CSV *template* (not real data)
├── backend/
│   ├── .env                   ⚠️ committed, contains a live Supabase DSN + password
│   ├── requirements.txt
│   ├── vercel.json            serverless config + daily cron
│   ├── api/index.py           Vercel entrypoint shim
│   ├── app/main.py            FastAPI app, 346 lines, 10 handlers
│   ├── app/database.py        engine + sessionmaker
│   ├── app/services/flood_risk_model.py    weight-overlay risk model, 49 lines
│   ├── app/services/rain_sync.py           ETL job, 283 lines
│   ├── sql/001_flood_risk_parameters.sql   DDL for parameter table + new columns
│   ├── download_batas.py      ETL: fetch kelurahan polygons from BIG ArcGIS
│   ├── import_kelurahan.py    ETL: GeoJSON → PostGIS staging → main table
│   ├── hitung_elevasi.py      ETL: zonal stats from a local DEM GeoTIFF
│   ├── hitung_elevasi_api.py  ETL: elevation via Open-Meteo elevation API
│   ├── init_bmkg_table.py     DDL for prakiraan_bmkg
│   ├── sync_prakiraan_bmkg.py ETL: forecast rows → prakiraan_bmkg
│   ├── inspect_geo.py         debug helper
│   ├── test_db.py             debug helper
│   ├── bmkg_test.json         saved sample BMKG API payload (2026-10-16)
│   └── .venv/                 ⚠️ 9 179 tracked files — a Windows virtualenv committed to git
└── frontend/
    ├── package.json, package-lock.json, vite.config.js, .oxlintrc.json, .gitignore
    ├── vercel.json            proxies /api/* to the deployed backend
    ├── index.html
    ├── public/{favicon.svg,icons.svg}
    └── src/
        ├── main.jsx           12 lines: React root
        ├── App.jsx            1 225 lines: all state + both layouts
        ├── Icons.jsx          420 lines: 43 inline SVG icon components
        ├── index.css          7 075 lines: the entire design system
        ├── App.css            344 lines: ⚠️ never imported (dead)
        ├── assets/{hero.png, react.svg, vite.svg}
        ├── utils/evacuationRouting.js     72 lines: Haversine + synthetic waypoints
        ├── data/evakuasiDanKanal.js       319 lines: 12 posko + 6 waterways
        ├── data/fasilitasKritis.js        190 lines: 12 critical facilities
        └── components/                    24 components, 3 262 lines total
```

Size of first-party code, excluding the vendored `.venv`:

| Area | Lines |
|---|---|
| Backend Python (app + scripts) | ~1 400 |
| Backend SQL | 21 |
| Frontend JSX/JS | ~7 100 |
| Frontend CSS | 7 419 |
| **Total** | **~15 900** |

Largest frontend files: `App.jsx` (1 225), `FloodMap.jsx` (1 092), `FloodDepthVisualization.jsx` (454), `index.css` (7 075).

---

## 3. Runtime architecture and request lifecycle

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Browser                                                                    │
│                                                                            │
│  index.html → main.jsx → <App/>                                            │
│      │                                                                     │
│      ├── App.jsx  ──── state: geojson, banjir, prakiraan, simulation, ...   │
│      │     │                                                               │
│      │     ├── AppHeader / DockedSidebar / SidebarFeatureDrawer (laptop)    │
│      │     ├── MobileBottomSheet / MobileDrawerModal (mobile)               │
│      │     └── FloodMap ── react-leaflet <MapContainer>                     │
│      │            ├── GeoJSON choropleth (153 polygons)                     │
│      │            ├── Markers: posko, facilities, GPS, route endpoints      │
│      │            ├── Polylines: evacuation route, waterways, buffer ring   │
│      │            └── Overlays: legend, route card, buffer tool, toasts     │
│      │                                                                     │
│      └── TideMonitorWidget ── own fetch + 5-minute poll                    │
│                                                                            │
└───────────────┬────────────────────────────────────────────────────────────┘
                │  fetch()   (JSON over HTTP)
                │  base URL: VITE_API_BASE_URL
                │            ?? (DEV ? http://127.0.0.1:8000 : "" /* same origin */)
                ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ FastAPI (uvicorn app.main:app, port 8000)                                  │
│   /api/kelurahan/geojson        ST_AsGeoJSON(geom)                         │
│   /api/banjir                   potensi_banjir ⋈ kelurahan                 │
│   /api/bmkg/prakiraan/{kode}    prakiraan_bmkg ⋈ kelurahan                 │
│   /api/prakiraan/{kode}         same handler (alias decorator)              │
│   /api/maritim/pasut  ──────────► https://marine-api.open-meteo.com        │
│   /api/cron/sync-weather ──────► Open-Meteo forecast + risk model          │
│   /api/health, /api/sync-status, /api/kelurahan,                           │
│   /api/kelurahan/{id}/hujan-terbaru, /                       (unused)      │
└───────────────┬────────────────────────────────────────────────────────────┘
                │  SQLAlchemy Engine (psycopg 3, pool_pre_ping=True)
                ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ PostgreSQL 15/16 + PostGIS  (Supabase pooler, port 6543)                   │
│   kelurahan, kelurahan_import, curah_hujan, potensi_banjir,                 │
│   elevasi_kelurahan, parameter_kerawanan_kelurahan, prakiraan_bmkg          │
└────────────────────────────────────────────────────────────────────────────┘
```

**Key architectural facts**

1. **No ORM models are used.** Every query is a raw SQL string executed with `sqlalchemy.text()` over an `engine.connect()` / `engine.begin()` block. `SessionLocal` is created in `database.py` but never imported anywhere.
2. **No Pydantic response models.** Endpoints return plain `dict` / `list[dict]`, so FastAPI's `jsonable_encoder` serialises `Decimal → float` and `datetime → ISO 8601` implicitly, and OpenAPI docs (`/docs`) show untyped schemas.
3. **The backend is stateless except for one module-level dict** — `last_sync_info` in `rain_sync.py` — which the `/api/sync-status` endpoint echoes. On Vercel serverless this is per-instance and therefore unreliable.
4. **The server is the API *and* optionally the static host.** `GET /` serves `frontend/dist/index.html` when built (Docker flow). It does **not** mount `/assets`, so the SPA's JS/CSS would 404 in that mode (see §9).
5. **Two external data providers only:** Open-Meteo (weather forecast, elevation, marine) and (nominally) BMKG. The BMKG path is incomplete — see §9.

---

## 4. Build, deployment and configuration

### 4.1 Environment variables

| Variable | Where read | Meaning |
|---|---|---|
| `DATABASE_URL` | `app/database.py` | SQLAlchemy DSN. Committed value is `postgresql+psycopg://postgres.<project>:<password>@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres` — a **direct** Supabase pooler connection, not the `?pgbouncer=true` transaction pooler used by serverless apps. |
| `CORS_ORIGINS` | `app/main.py:24` | Comma-separated allow-list, default `http://localhost:5173,http://127.0.0.1:5173`. |
| `VITE_API_BASE_URL` | `App.jsx:32`, `TideMonitorWidget.jsx:23` | Optional absolute API base. Trailing slash is stripped with `.replace(/\/$/, "")`. |

`load_dotenv()` in `database.py` reads `backend/.env` relative to the process CWD, so uvicorn must be launched from `backend/`.

### 4.2 `frontend/vite.config.js`

```js
export default defineConfig({ plugins: [react()] })
```

Minimal: no dev proxy, no base path, no build tweaks. Consequence: during development the browser calls `http://127.0.0.1:8000` **cross-origin**, which is why the backend needs CORS for port 5173.

### 4.3 Frontend production hosting — `frontend/vercel.json`

```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://webgis2mbc-backend.vercel.app/api/:path*" },
    { "source": "/(.*)",       "destination": "/index.html" }
  ]
}
```

In production the frontend is served from Vercel with `API = ""`, so every `fetch("/api/...")` hits the same origin and Vercel's rewrite proxies it to the separately deployed Python backend. This is the **intended** deployment. The second rewrite makes every unknown path fall back to `index.html` (SPA routing).

### 4.4 Backend production hosting — `backend/vercel.json`

```json
{
  "builds": [{ "src": "api/index.py", "use": "@vercel/python" }],
  "routes": [{ "src": "/(.*)", "dest": "api/index.py" }],
  "crons": [{ "path": "/api/cron/sync-weather", "schedule": "0 0 * * *" }]
}
```

Every request is handled by `api/index.py`, which re-exports `app` from `app.main`. A Vercel cron hits `/api/cron/sync-weather` once a day at 00:00 UTC (= 08:00 WITA).

### 4.5 Root `vercel.json` — stale

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "functions": { "api/**/*.py": { "runtime": "python3.12" } },
  "builds": [
    { "src": "frontend/package.json", "use": "@vercel/static-build", "config": { "distDir": "frontend/dist" } },
    { "src": "api/main.py", "use": "@vercel/python" } ] }
```

It references `api/main.py` at the repository root, which **does not exist** (the real module is `backend/api/index.py`). This file describes an older monorepo layout and would fail if deployed as-is. Note also that Vercel forbids combining `builds` with `rewrites`/`functions` in a modern project — another sign it is legacy.

### 4.6 `Dockerfile` (self-contained single-image deployment)

Stage 1 `frontend-build`: `node:20-alpine`, `npm ci`, `npm run build` → `/app/frontend/dist`.
Stage 2 `backend`: `python:3.12-slim`, creates `/app/.venv`, `pip install -r requirements.txt`, copies `backend/` into `/app`, then copies the built `dist` to `/app/frontend/dist`. Exposes 8000, `CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]`.

The `GET /` handler resolves `Path(__file__).resolve().parents[2] / "frontend" / "dist" / "index.html"`:

- In Docker: `/app/app/main.py → parents[2] = /app` → `/app/frontend/dist/index.html` ✔
- In local dev: `backend/app/main.py → parents[2] = repo root` → `frontend/dist/index.html` ✔ (if a build exists)

### 4.7 Dependencies

`backend/requirements.txt` pins 30 packages, notably `fastapi 0.143.1`, `starlette 1.8.0`, `sqlalchemy 2.1.4`, `psycopg[binary] 3.3.6`, `httpx 0.28.1`, `uvicorn 0.54.0`, plus `apscheduler` (declared but **never imported**) and `GeoAlchemy2` (declared, unused — the import scripts use `to_postgis` from GeoPandas instead).

`frontend/package.json` runtime deps are only `leaflet`, `react`, `react-dom`, `react-leaflet`; dev deps `vite`, `@vitejs/plugin-react`, `oxlint`, React type packages. No UI framework, no state library, no CSS framework, no HTTP client — everything is hand-rolled with `useState` + bare `fetch`.

---

## 5. Backend deep dive

### 5.1 `backend/app/database.py`

```python
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL belum diatur dalam file .env")
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
```

- `load_dotenv()` loads `backend/.env` into `os.environ` (no override of already-set vars).
- Fails **at import time** if the DSN is missing → uvicorn dies immediately with a clear message, which is deliberate.
- `create_engine(..., pool_pre_ping=True)` issues a cheap `SELECT 1` before handing out a pooled connection; important because Supabase's pooler silently closes idle connections.
- No `pool_size`/`max_overflow`/`pool_recycle` tuning → SQLAlchemy defaults (5 + 10 overflow, no recycle). On the serverless backend this can exhaust Postgres connections under load.
- `SessionLocal` is dead code.

### 5.2 `backend/app/main.py`

346 lines, 10 route functions across 11 URL paths (one handler carries two decorators).

#### 5.2.1 App object and CORS (lines 16–42)

```python
app = FastAPI(title="JeneBosi (JB)",
              description="WebGIS potensi banjir dan rute evakuasi Kota Makassar",
              version="1.3.0")

allowed_origins = [o.strip() for o in os.getenv("CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()]

app.add_middleware(CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"])
```

- The regex means **any** `*.vercel.app` origin (including attacker-controlled preview deployments) is allowed with credentials. Cookies aren't used, so the practical risk is low, but it is a permissive default worth tightening.
- `allow_credentials=True` + wildcard-ish origins also forbids `allow_origins=["*"]`; hence the explicit list + regex pattern.
- A Vite preview running on a sandbox host (e.g. `https://<port>-<id>.e2b.app`) is **not** in this list → the browser will block its API calls unless `CORS_ORIGINS` is extended.

#### 5.2.2 `GET /` → `beranda()` (lines 48–53)

```python
index_file = Path(__file__).resolve().parents[2] / "frontend" / "dist" / "index.html"
if index_file.is_file():
    return FileResponse(index_file)
return {"aplikasi": "JeneBosi (JB)", "status": "aktif", "dokumentasi": "/docs"}
```

Serves the built SPA when present, otherwise a tiny JSON banner pointing at `/docs`. **No `StaticFiles` mount for `/assets`**, so the served `index.html` would reference `/assets/index-*.js` that 404 — the Docker image is therefore not a working single-container deployment without an extra mount.

#### 5.2.3 `GET /api/health` (lines 59–66)

```sql
SELECT current_database();
SELECT PostGIS_Version();
SELECT COUNT(*) FROM public.kelurahan;
```

Returns `{status:"ok", database, postgis, jumlah_kelurahan}`. Any exception becomes `HTTPException(503, "Koneksi database gagal: ...")`. Note it leaks the driver's raw error text to clients (host, user, sometimes credentials hints).

#### 5.2.4 `GET /api/cron/sync-weather` (lines 74–82)

```python
@app.get("/api/cron/sync-weather")
async def trigger_weather_sync():
    try:
        result = sync_curah_hujan_dan_banjir()   # ← fully blocking
        return {"status": "success", "data": result}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}
```

- Declared `async def` but calls a **synchronous, network-bound** function. It blocks the event loop for the whole ETL (up to `ceil(153/50)=4` HTTP calls with a 30 s timeout each, plus DB writes). Should be `def` (FastAPI would run it in a threadpool) or wrapped in `run_in_threadpool`.
- Always returns HTTP 200, even on failure — Vercel cron will never see a non-2xx, so failures are invisible to monitoring.
- **No authentication.** Anyone who knows the URL can trigger a write-heavy job (free DoS / data churn vector). Vercel cron requests can be distinguished via the `CRON_SECRET`/`Authorization` header, which is not checked here.

#### 5.2.5 `GET /api/sync-status` (lines 87–88)

Returns the module-level `last_sync_info` dict straight from `rain_sync`. Shape:

```json
{ "status": "belum_berjalan|sedang_berjalan|selesai|gagal",
  "waktu_mulai": null, "waktu_selesai": null,
  "total_kelurahan": 0, "berhasil": 0, "gagal": 0, "pesan": "..." }
```

Because it is in-process memory, on Vercel it reflects only the instance that answered, and resets on cold start.

#### 5.2.6 `GET /api/kelurahan?q=` (lines 95–110) — *unused by the frontend*

```sql
SELECT id, kode_wilayah, nama_kelurahan
FROM public.kelurahan
WHERE nama_kelurahan ILIKE :q
ORDER BY nama_kelurahan LIMIT 100
```

`q` defaults to `""` → `%` → returns everything (up to 100). Parameter is bound (`:q`), so no SQL injection. `ILIKE '%q%'` cannot use a plain btree index; at 153 rows irrelevant.

#### 5.2.7 `GET /api/kelurahan/geojson` (lines 116–140) — **the map's backbone**

```sql
SELECT id, kode_wilayah, nama_kelurahan,
       ST_AsGeoJSON(geom)::json AS geometry
FROM public.kelurahan
WHERE geom IS NOT NULL
ORDER BY nama_kelurahan
```

Then it hand-builds a GeoJSON `FeatureCollection`:

```python
{"type": "FeatureCollection", "total": len(features),
 "features": [{"type": "Feature", "geometry": r["geometry"],
               "properties": {"id":..., "kode_wilayah":..., "nama_kelurahan":...}}]}
```

Notes:
- `ST_AsGeoJSON(...)::json` makes psycopg return a Python `dict`, so the geometry is embedded natively rather than as a string.
- No simplification (`ST_Simplify`) and no precision reduction (`ST_AsGeoJSON(geom, 6)`). The source GeoJSON is 1.3 MB; with 153 detailed MultiPolygons the HTTP payload will be on that order. Every page load downloads it — a prime candidate for `ST_SimplifyPreserveTopology` + gzip + ETag caching.
- The response is **not** cached (`Cache-Control` absent).
- `total` is a custom property; standard GeoJSON consumers ignore it, the frontend doesn't use it.

#### 5.2.8 `GET /api/kelurahan/{kelurahan_id}/hujan-terbaru` (lines 147–160) — *unused by the frontend*

```sql
SELECT k.id AS kelurahan_id, k.nama_kelurahan,
       ch.waktu_pengamatan AS tanggal, ch.nilai_mm AS curah_hujan
FROM public.kelurahan k
JOIN public.curah_hujan ch ON k.id = ch.kelurahan_id
WHERE k.id = :id
ORDER BY ch.waktu_pengamatan DESC LIMIT 1
```

Latest rainfall observation for one kelurahan. `404 "Data hujan tidak ditemukan"` if none. **Bug:** the `except` clause catches the `HTTPException` raised inside the `try` and re-raises it as `HTTPException(500, str(exc))` — the 404 becomes a 500 with the message `"404: Data hujan tidak ditemukan"`. (Same anti-pattern appears in other handlers, but only here can a deliberate `HTTPException` be raised inside the `try`.)

#### 5.2.9 `GET /api/banjir` (lines 169–193) — colours the map

```sql
SELECT pb.kelurahan_id, k.nama_kelurahan, k.kode_wilayah,
       pb.tingkat, pb.hujan_mm, pb.elevasi_m,
       pb.indeks_kerawanan, pb.estimasi_kedalaman_cm,
       pb.kondisi_bmkg, pb.waktu_analisis,
       pb.metode, pb.sumber_model
FROM public.potensi_banjir pb
JOIN public.kelurahan k ON k.id = pb.kelurahan_id
ORDER BY k.nama_kelurahan
```

Returns the *latest* `potensi_banjir` row per kelurahan **only because the writer keeps one row per kelurahan** (see `rain_sync`: it looks up `existing ... LIMIT 1` and UPDATEs, else INSERTs). If historical rows ever accumulate (e.g. from another writer), this endpoint would return duplicates and the frontend's `Map` would silently keep the last one.

The frontend matches these rows to polygons by **both** `kelurahan_id` and `nama_kelurahan` (see `FloodMap.banjirMap`), because the map click payload and the risk rows come from different sources.

#### 5.2.10 `GET /api/bmkg/prakiraan/{kode_wilayah}` and `/api/prakiraan/{kode_wilayah}` (lines 201–235)

Two decorators stacked on one function — `/api/bmkg/prakiraan/*` is the canonical path, `/api/prakiraan/*` is a legacy alias kept so an older frontend build keeps working. The frontend intentionally tries them in sequence.

```sql
SELECT pb.id, pb.kelurahan_id, k.nama_kelurahan,
       pb.kondisi_cuaca  AS kondisi,
       pb.suhu_c,
       pb.kelembapan_persen,
       pb.waktu_prakiraan AS waktu_lokal,
       pb.sumber
FROM public.prakiraan_bmkg pb
JOIN public.kelurahan k ON k.id = pb.kelurahan_id
WHERE k.kode_wilayah = :kode
  AND pb.waktu_prakiraan >= (NOW() - INTERVAL '6 hours')   -- first attempt
ORDER BY pb.waktu_prakiraan LIMIT 20
```

If that returns nothing, a second query drops the time filter and takes the 20 most recent rows, **descending** — meaning the fallback list is ordered newest→oldest, opposite to the primary list. The frontend renders `prakiraan.slice(0, 8)` as a time series, so in fallback mode the "timeline" runs backwards.

Response envelope: `{"prakiraan": [...]}` (the big comment block above the handler documents exactly which field aliases the frontend accepts, which is a nice piece of contract documentation living next to the code).

**Semantic caveat:** the column `waktu_prakiraan` is stored in the server's timezone handling as `TIMESTAMPTZ`, while the values written by `sync_prakiraan_bmkg.py` come from a local-time string cast with `CAST(:waktu AS timestamp)` — i.e. no timezone is attached, so Postgres interprets it in the session timezone. This is an 8-hour error waiting to happen if the DB session TZ is UTC (Supabase default).

#### 5.2.11 `GET /api/maritim/pasut` (lines 244–346) — tide model

Async handler that calls Open-Meteo Marine:

```
https://marine-api.open-meteo.com/v1/marine
  ?latitude=-5.12&longitude=119.40          (Pelabuhan Paotere)
  &current=wave_height,wave_period,wave_direction,ocean_current_velocity
  &hourly=wave_height,wave_period
  &timezone=Asia/Makassar&forecast_days=1
```

with `httpx.AsyncClient(timeout=15.0)`, then derives a **synthetic tide**:

```python
now_wita  = datetime.now(timezone.utc) + timedelta(hours=8)
t_hours   = now_wita.hour + now_wita.minute / 60
tide_h    = round(0.9 + 0.65 * cos(2π · t_hours / 12.42), 2)   # M2, MSL 0.9 m, A 0.65 m
total_elev = round(tide_h + (wave_h or 0) * 0.1, 2)            # 10 % of wave height as surge
```

- 12.42 h is the M2 semi-diurnal constituent period; amplitude 0.65 m around a 0.9 m mean — a plausible-but-invented harmonic, documented in the code comment as *"indicative only"*.
- The 0.1 × wave height term is a crude setup/surge proxy.

Status classification (`status_rob`):

| `total_elevasi_m` | `status_rob` | label |
|---|---|---|
| ≥ 1.40 | `ekstrem` | "Pasang Ekstrem – Risiko Rob Tinggi" |
| ≥ 1.10 | `waspada` | "Pasang Waspada" |
| otherwise | `normal` | "Surut Normal" |

Daily schedule: four hard-coded event hours `[1, 7, 13, 19]` with labels "Pasang Pertama / Surut Pagi / Pasang Siang / Surut Malam", each height recomputed from the same cosine, formatted as `"+{h} m"` (so a low water of 0.26 m renders as `+0.26 m`, visually odd).

Response contract (exactly what `TideMonitorWidget.jsx` reads):

```json
{ "status": "ok",
  "sumber": "Open-Meteo Marine API + Model Harmonik M2",
  "stasiun": "Pelabuhan Paotere Makassar (-5.12°S, 119.40°E)",
  "waktu_wita": "14:05 WITA",
  "ketinggian_pasut_m": 1.24, "tinggi_gelombang_m": 0.6,
  "kecepatan_arus_ms": 0.31, "periode_gelombang_detik": 5.2,
  "total_elevasi_m": 1.3,
  "status_rob": "waspada", "status_label": "...", "status_desc": "...",
  "jadwal_harian": [ {"waktu":"01:00 WITA","jenis":"Pasang Pertama","tinggi":"+1.5 m","peak":true}, ... ] }
```

**Fallback:** any exception (network, rate limit, timeout) returns HTTP 200 with `status:"offline_fallback"` and **hard-coded plausible numbers** (0.55 m tide, 0.40 m wave, static schedule). The widget therefore can never show an error state — it just shows stale/fake-but-labelled values. The `status` field is the only signal, and the widget does not display it prominently.

Also note `round(current_v, 2) if current_v is not None else None` guards `None`, but `wave_h` is used unguarded in `total_elev` — `(wave_h or 0)` handles it, so fine.

### 5.3 `backend/app/services/flood_risk_model.py`

A 49-line pure function module — the scientific heart of the "risk" label.

```python
WEIGHTS = {"penggunaan_lahan": 35,   # land use
           "curah_hujan": 25,        # rainfall
           "jarak_sungai": 20,       # distance to river
           "jenis_tanah": 10,        # soil type
           "kemiringan_lereng": 10}  # slope
```

Adapted from **Nurliah et al. (2025)** — a weighted spatial-overlay (skor) method. Each parameter is scored 1–5.

`rain_score_from_bmkg(condition)` maps a **BMKG forecast *condition string*** (not millimetres) to a 1–5 score:

| condition contains | score |
|---|---|
| "ekstrem", "petir", "lebat" | 5 |
| "hujan" (any other) | 4 |
| "berawan", "kabut" | 2 |
| anything else / `None` | 1 |

The docstring is explicit: *"bukan mm observasi"* — not observed millimetres. This is a deliberate honesty decision, and it is the reason the 25 % rainfall weight is driven by a categorical forecast rather than by Open-Meteo's precipitation number the same job just fetched.

`calculate_risk(...)`:

```python
index = Σ weight[i] · score[i]            # range 100 … 500
level = "Rendah"        if index ≤ 230
        "Sedang"        if index ≤ 330
        "Tinggi"        if index ≤ 430
        "Sangat Tinggi" otherwise
depth_cm = max(0, min(120, round(((index-100)/400) * 120 / 5) * 5))
```

- Scores outside 1–5 raise `ValueError("Setiap skor parameter harus bernilai 1 sampai 5.")`.
- The index range is 100 (all 1s) → 500 (all 5s); thresholds split it into roughly four equal quarters (230/330/430).
- `depth_cm` rescales the index linearly to 0–120 cm, snaps to 5 cm steps, caps at 120. The comment calls it *"Indikator komunikasi publik, bukan keluaran hidrodinamika/sensor"* — a public-communication indicator, not a hydrodynamic or sensor output.

**Worked example.** Land use 4, soil 3, river distance 4, slope 2, condition "Hujan Lebat" → rain 5:

```
index = 4·35 + 5·25 + 4·20 + 3·10 + 2·10 = 140 + 125 + 80 + 30 + 20 = 395
level = "Tinggi"                                   (330 < 395 ≤ 430)
depth = round((395-100)/400 · 24) · 5 = round(17.7)·5 = 18·5 = 90 cm
```

Returned payload: `{"index": 395, "level": "Tinggi", "depth_cm": 90, "scores": {...}}`.

### 5.4 `backend/app/services/rain_sync.py`

The daily ETL job — 283 lines, the only write path in production.

#### Module state

```python
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
BATCH_SIZE = 50
last_sync_info = {"status": "belum_berjalan", "waktu_mulai": None, ...}
```

`last_sync_info` is a mutable module dict, reassigned field-by-field (`global last_sync_info` is declared) so `/api/sync-status` sees progress while the job runs.

#### Step 1 — read the working set

```sql
SELECT k.id AS kelurahan_id, k.kode_wilayah, k.nama_kelurahan,
       e.latitude, e.longitude, e.elevasi_titik_m,
       p.skor_penggunaan_lahan, p.skor_jenis_tanah,
       p.skor_jarak_sungai, p.skor_kemiringan_lereng,
       bmkg.kondisi_cuaca AS kondisi_bmkg
FROM public.kelurahan k
LEFT  JOIN public.elevasi_kelurahan e  ON e.kelurahan_id = k.id
JOIN       public.parameter_kerawanan_kelurahan p ON p.kelurahan_id = k.id   -- INNER
LEFT  JOIN LATERAL (
    SELECT kondisi_cuaca FROM public.prakiraan_bmkg
    WHERE kelurahan_id = k.id AND waktu_prakiraan >= LOCALTIMESTAMP
    ORDER BY waktu_prakiraan LIMIT 1
) bmkg ON TRUE
WHERE e.latitude IS NOT NULL AND e.longitude IS NOT NULL
ORDER BY k.id
```

- **INNER JOIN on `parameter_kerawanan_kelurahan`** is the key gate: a kelurahan with no manually-entered 1–5 scores is *silently skipped*. If that table is empty, `total_kel == 0` and the job returns early with *"Tidak ada kelurahan dengan koordinat latitude/longitude yang valid."* — a misleading message for what is really a missing-parameters problem.
- `LEFT JOIN LATERAL ... LIMIT 1` picks the earliest *future* BMKG condition per kelurahan (a per-row subquery — correct, and efficient enough at 153 rows).
- `e.latitude IS NOT NULL` in `WHERE` turns the `LEFT JOIN` on `elevasi_kelurahan` into an effective inner join.

#### Step 2 — batch call Open-Meteo

For each chunk of 50:

```python
params = {"latitude": [..50 floats..], "longitude": [..50 floats..],
          "daily": ["precipitation_sum"], "current": ["precipitation"],
          "timezone": "Asia/Makassar"}
resp = client.get(OPEN_METEO_URL, params=params)
```

- Open-Meteo accepts comma/array-separated coordinates and returns a **list of objects** in the same order when >1 point, or a single object for 1 point — hence `items = hasil_json if isinstance(hasil_json, list) else [hasil_json]`, then `zip(batch, items)`.
- Non-200 → the batch is logged and **skipped** (`continue`), and those kelurahan simply never appear in `hujan_records`. `berhasil` therefore counts only successful points and `gagal = total_kel - berhasil`.
- Precipitation value preference: `daily.precipitation_sum[0]` (today's total) → else `current.precipitation` → else `0.0`. Since `daily` covers the whole calendar day and the job runs at 00:00 UTC / 08:00 WITA, "today's sum" is mostly a *forecast* for the rest of the day, not a measurement. The frontend's UI text sometimes calls this "hujan hari ini".

Each accepted point becomes a dict carrying both the observation and the static scores it will need later (so the DB transaction does no joins).

#### Step 3 — one transaction for all writes

```python
with engine.begin() as conn:      # single transaction, implicit commit/rollback
    for rec in hujan_records:
        INSERT INTO public.curah_hujan (kelurahan_id, waktu_pengamatan, nilai_mm,
                                        jenis_data, sumber, created_at)
        VALUES (..., 'Harian Otomatis', 'Open-Meteo API', NOW())
        ...
        hasil_model = calculate_risk(land_use_score=..., weather_condition=rec["kondisi_bmkg"])
        existing = SELECT id FROM public.potensi_banjir WHERE kelurahan_id = :id LIMIT 1
        if existing: UPDATE ... WHERE id = :id
        else:        INSERT ...
```

Characteristics:

- **Write amplification / history growth:** every run appends one `curah_hujan` row per kelurahan (153/day, ~55 k/year) but keeps exactly one `potensi_banjir` row per kelurahan (upsert-by-select). So `curah_hujan` is an append-only time series with no retention policy.
- **N+1 pattern:** 1 SELECT + 1 INSERT/UPDATE per kelurahan inside the loop. A `INSERT ... ON CONFLICT (kelurahan_id) DO UPDATE` would collapse this to one statement — but that requires a unique constraint on `potensi_banjir(kelurahan_id)` which the schema (as far as this repo shows) does not declare.
- **All-or-nothing:** one bad row (e.g. a NULL score violating `NOT NULL`) rolls back the entire batch, including the `curah_hujan` inserts. The outer `except` then records `status:"gagal"`.
- `hujan_val` (mm) is stored in `potensi_banjir.hujan_mm` but is **not** an input to `calculate_risk` — the rainfall weight uses the BMKG categorical score. This is intentional (see §5.3) but easy to misread.
- `metode = "Overlay berbobot kerawanan banjir Makassar"`, `sumber_model = "Nurliah et al. (2025), overlay berbobot"` are stamped onto every row for provenance.

#### Step 4 — bookkeeping

```python
last_sync_info.update({"status": "selesai", "waktu_selesai": ...,
    "total_kelurahan": total_kel, "berhasil": berhasil,
    "gagal": total_kel - berhasil,
    "pesan": f"Berhasil memperbarui data curah hujan & risiko banjir untuk {berhasil} kelurahan."})
```

Global `except` → `status:"gagal"` and returns (never raises). So the HTTP layer always sees a dict.

#### Idempotence and concurrency

Two overlapping runs (e.g. cron + manual hit) would both read, then both write — no advisory lock, no `WHERE NOT EXISTS` guard. The `potensi_banjir` update is last-writer-wins; `curah_hujan` gets duplicate timestamps.

### 5.5 `backend/api/index.py`

```python
ROOT_DIR = Path(__file__).resolve().parent.parent      # backend/
if str(ROOT_DIR) not in sys.path: sys.path.insert(0, str(ROOT_DIR))
from app.main import app
```

Vercel's Python builder looks for a module-level `app`/`handler`. Because the function lives in `backend/api/`, the `app` package in `backend/app/` is not importable by default, so the shim prepends `backend/` to `sys.path`. It also needs `vercel.json` to route `/(.*)` to this file.

### 5.6 One-shot ETL / utility scripts

These are **developer/operator scripts**, not part of the served app. Several contain hard-coded Windows paths (`E:\webgis2mbc\data\...`) that will fail on Linux/macOS/CI.

#### `download_batas.py`
Fetches kelurahan boundaries from the **BIG** (Badan Informasi Geospasial) ArcGIS REST service:

```
https://geoservices.big.go.id/gis/rest/services/BAPANAS/Batas_Administrasi/MapServer/2/query
  ?where=WADMKK LIKE '%Makassar%'&outFields=*&returnGeometry=true&outSR=4326&f=geojson
```

with a 90 s timeout. Validates `type == "FeatureCollection"` and non-empty features, then writes `kelurahan.geojson` and prints attribute names. Output folder is hard-coded to `E:\webgis2mbc\data\batas_kelurahan`.

#### `inspect_geo.py`
Prints feature count, CRS, columns, geometry-type counts and the first 3 rows of the first `.geojson`/`.shp` in the same hard-coded folder. Pure debugging aid.

#### `import_kelurahan.py`
The loader from GeoJSON → PostGIS. Read it as a checklist of geospatial hygiene:

1. Read with GeoPandas; abort if empty, if `crs is None` (*"Jangan menebak CRS sumber"* — do not guess the source CRS).
2. Require column `WADMKD` (village name); filter `WADMKK` containing "Makassar".
3. Build `kode_wilayah` from `KDEPUM`, falling back to `KDEBPS` per-cell (`fillna`), then strip.
4. Keep only `kode_wilayah`, `nama_kelurahan`, `geometry`; drop nulls and empties.
5. Reproject to `EPSG:4326`; `make_valid()` every invalid geometry; keep only Polygon/MultiPolygon; drop duplicate codes.
6. `gdf.to_postgis(name="kelurahan_import", if_exists="replace")` → staging table (GeoPandas creates it with a `geometry` column, not `geom`).
7. Validate the staging count > 0, then a single `INSERT ... SELECT` into `public.kelurahan`:

```sql
INSERT INTO public.kelurahan (kode_wilayah, nama_kelurahan, geom)
SELECT kode_wilayah, nama_kelurahan,
       ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_Force2D(geometry)), 3))::geometry(MultiPolygon,4326)
FROM public.kelurahan_import
WHERE geometry IS NOT NULL AND NOT ST_IsEmpty(geometry)
ON CONFLICT (kode_wilayah) DO UPDATE
  SET nama_kelurahan = EXCLUDED.nama_kelurahan, geom = EXCLUDED.geom
```

`ST_CollectionExtract(..., 3)` keeps only polygons (3 = POLYGON type code), `ST_Force2D` drops Z, `ST_Multi` guarantees MultiPolygon to match the target type, and `ON CONFLICT (kode_wilayah)` requires (and implies) a unique constraint on `kode_wilayah`. Idempotent re-import. ✔

The committed `data/batas_kelurahan/kelurahan.geojson` has exactly **153 features**, `WADMKK: "Kota Makassar"`, `KDEPUM` like `73.71.11.1007`, all `MultiPolygon` — matching the loader's expectations and the "153 kelurahan" figure quoted in the UI.

#### `hitung_elevasi.py` — zonal statistics from a local DEM
- Reads `data/elevasi/dem_makassar.tif` (not in the repo) with `rasterio`, and polygons from PostGIS with `geopandas.read_postgis`.
- Reprojects polygons to the raster CRS (critical — the script asserts both CRSs exist).
- `rasterstats.zonal_stats(..., stats=["min","mean","max","count"], nodata=src.nodata, all_touched=False)`.
- Renames to `elevasi_min_m / elevasi_rata_m / elevasi_maks_m / jumlah_piksel`, prepends `kelurahan_id` + `nama_kelurahan`, writes `data/elevasi/hasil_elevasi.csv`.
- **It produces a CSV, not a DB write** — you would load it separately. `all_touched=False` means pixels whose centre lies inside the polygon count; good default.

#### `hitung_elevasi_api.py` — elevation without a DEM (the one actually used)
- For each kelurahan, computes a representative point in SQL:
  `ST_Y/ST_X(ST_PointOnSurface(ST_Transform(geom, 4326)))` — `PointOnSurface` guarantees the point lies *inside* the polygon (unlike a centroid, which can fall outside concave shapes).
- Batches 100 points per call to `https://api.open-meteo.com/v1/elevation` as comma-joined strings.
- Validates that `len(elevations) == len(batch)` (a good guard against silent misalignment), skips `None`s, `time.sleep(0.3)` between batches for rate limiting.
- Upserts into `elevasi_kelurahan(kelurahan_id, latitude, longitude, elevasi_titik_m, sumber, diperbarui_pada)` with `ON CONFLICT (kelurahan_id) DO UPDATE`.
- `sumber = "Open-Meteo / Copernicus DEM GLO-90"` — this is the value shown to users in `DataSourceInfo.jsx`.
- Prints a summary and lists failures.

This is what populates the `elevasi_kelurahan` rows the risk job needs.

#### `init_bmkg_table.py`
```sql
CREATE TABLE IF NOT EXISTS public.prakiraan_bmkg (
    id SERIAL PRIMARY KEY,
    kelurahan_id INTEGER REFERENCES public.kelurahan(id) ON DELETE CASCADE,
    kode_wilayah VARCHAR(50),
    waktu_prakiraan TIMESTAMPTZ,
    suhu_c NUMERIC(5,2), kelembapan_persen NUMERIC(5,2),
    kondisi_cuaca TEXT, sumber TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bmkg_kelurahan_waktu
    ON public.prakiraan_bmkg(kelurahan_id, waktu_prakiraan);
```
Missing both a `UNIQUE(kode_wilayah, waktu_prakiraan)` constraint and a `diambil_pada` column, which `sync_prakiraan_bmkg.py` needs — see §9.

#### `sync_prakiraan_bmkg.py`
Intended to fill `prakiraan_bmkg`. Loop over every kelurahan with a non-empty `kode_wilayah`, `GET {API_BASE}/api/bmkg/prakiraan/{kode}` with `API_BASE = "http://127.0.0.1:8000"`, `time.sleep(1.1)` between calls (a polite rate limit for an external API), then upsert every returned row:

```sql
INSERT INTO public.prakiraan_bmkg
  (kelurahan_id, kode_wilayah, waktu_prakiraan, suhu_c, kelembapan_persen, kondisi_cuaca, sumber)
VALUES (:kelurahan_id, :kode_wilayah, CAST(:waktu AS timestamp), :suhu, :kelembapan, :kondisi, 'BMKG')
ON CONFLICT (kode_wilayah, waktu_prakiraan) DO UPDATE SET
  kelurahan_id = EXCLUDED.kelurahan_id, suhu_c = EXCLUDED.suhu_c,
  kelembapan_persen = EXCLUDED.kelembapan_persen,
  kondisi_cuaca = EXCLUDED.kondisi_cuaca, sumber = EXCLUDED.sumber,
  diambil_pada = NOW()
```

**This is circular and structurally broken:**
- It reads from *our own* `/api/bmkg/prakiraan/{kode}` endpoint, which reads *the same table*. It therefore only re-inserts what is already stored — it never contacts BMKG.
- `ON CONFLICT (kode_wilayah, waktu_prakiraan)` needs a matching unique index, which `init_bmkg_table.py` never creates → Postgres raises *"there is no unique or exclusion constraint matching the ON CONFLICT specification"*.
- `diambil_pada` is not a column in the generated schema → second error.
- `CAST(:waktu AS timestamp)` strips timezone information from what the endpoint returns as an ISO/TIMESTAMPTZ string.

The only artifact in the repo showing what a **real** BMKG response looks like is `backend/bmkg_test.json` — a saved payload from `api.bmkg.go.id` for Kelurahan Antang (adm4 `73.71.12.1004`) containing `data[].cuaca[][]` arrays with `datetime`, `t`, `hu`, `weather_desc`, `local_datetime`, etc. Nothing in the backend parses that format. This is the clearest "unfinished feature" in the project: **the BMKG integration exists as a data contract, a sample file, a table, an endpoint and a sync script, but no code actually calls BMKG.**

#### `test_db.py`
Two-line smoke test: `SELECT current_database(), PostGIS_Full_Version()`.

### 5.7 SQL migration and the inferred database schema

`sql/001_flood_risk_parameters.sql`:

```sql
CREATE TABLE IF NOT EXISTS public.parameter_kerawanan_kelurahan (
    kelurahan_id INTEGER PRIMARY KEY REFERENCES public.kelurahan(id) ON DELETE CASCADE,
    skor_penggunaan_lahan  SMALLINT NOT NULL CHECK (... BETWEEN 1 AND 5),
    skor_jenis_tanah       SMALLINT NOT NULL CHECK (... BETWEEN 1 AND 5),
    skor_jarak_sungai      SMALLINT NOT NULL CHECK (... BETWEEN 1 AND 5),
    skor_kemiringan_lereng SMALLINT NOT NULL CHECK (... BETWEEN 1 AND 5),
    sumber_penggunaan_lahan  TEXT NOT NULL,
    sumber_jenis_tanah       TEXT NOT NULL,
    sumber_jarak_sungai      TEXT NOT NULL,
    sumber_kemiringan_lereng TEXT NOT NULL DEFAULT 'Copernicus DEM',
    diperbarui_pada TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.potensi_banjir
  ADD COLUMN IF NOT EXISTS indeks_kerawanan      NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS estimasi_kedalaman_cm NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS kondisi_bmkg          TEXT,
  ADD COLUMN IF NOT EXISTS sumber_model          TEXT;
```

The header comment is a methodological instruction to operators: *"Nilai 1-5 harus diisi dari overlay layer penggunaan lahan, jenis tanah, jarak sungai, dan kemiringan lereng Copernicus. Jangan mengisi dengan asumsi."* — fill from actual overlay layers, do not assume. Combined with `CHECK ... BETWEEN 1 AND 5` and `NOT NULL` source columns, this table is the audit trail for the weights. **There is no seed/ETL script for it in the repo**, which is why the daily sync can quietly do nothing.

**Full inferred schema** (every column below is referenced by some query in this repo; the tables `kelurahan`, `curah_hujan`, `potensi_banjir`, `elevasi_kelurahan` have no DDL in the repo and must pre-exist):

```
public.kelurahan
  id              SERIAL PK
  kode_wilayah    VARCHAR  UNIQUE (implied by ON CONFLICT)
  nama_kelurahan  TEXT
  geom            geometry(MultiPolygon, 4326)   -- populated from staging.geometry

public.kelurahan_import          -- GeoPandas staging, recreated on every import
  kode_wilayah, nama_kelurahan, geometry

public.curah_hujan
  kelurahan_id → kelurahan.id
  waktu_pengamatan TIMESTAMPTZ
  nilai_mm          NUMERIC
  jenis_data        TEXT   ('Harian Otomatis', 'Harian', …)
  sumber            TEXT   ('Open-Meteo API', …)
  created_at        TIMESTAMPTZ DEFAULT NOW()

public.potensi_banjir
  id                  SERIAL PK
  kelurahan_id        → kelurahan.id      (logically 1:1; no unique constraint visible)
  waktu_analisis      TIMESTAMPTZ
  hujan_mm            NUMERIC
  elevasi_m           NUMERIC
  tingkat             TEXT   ('Rendah'|'Sedang'|'Tinggi'|'Sangat Tinggi')
  metode              TEXT
  indeks_kerawanan    NUMERIC(6,2)
  estimasi_kedalaman_cm NUMERIC(6,2)
  kondisi_bmkg        TEXT
  sumber_model        TEXT

public.elevasi_kelurahan
  kelurahan_id     SERIAL PK
  latitude, longitude NUMERIC
  elevasi_titik_m  NUMERIC
  sumber           TEXT
  diperbarui_pada  TIMESTAMPTZ

public.parameter_kerawanan_kelurahan   -- see DDL above

public.prakiraan_bmkg                  -- see DDL above
  + (wanted) UNIQUE(kode_wilayah, waktu_prakiraan), diambil_pada
```

`data/curah_hujan.csv` (`kode_wilayah,tanggal,nilai_mm,jenis_data,sumber` + one example row with `NAMA_SUMBER`) is a **template** showing the intended manual-import format; nothing reads it.

---

## 6. Frontend deep dive

### 6.1 Entry points and build config

**`frontend/index.html`** — the shell. Notable meta tags: `maximum-scale=1.0, user-scalable=no, viewport-fit=cover` (disables pinch-zoom, which is deliberate for a map app but an accessibility regression), `theme-color #176B65`, `mobile-web-app-capable` + `apple-mobile-web-app-*` (PWA-ish, no manifest or service worker exists), title "WebGIS2MBC — Kesiapsiagaan & Informasi Risiko Banjir Makassar". `<div id="root">` + `<script type="module" src="/src/main.jsx">`.

**`src/main.jsx`** (12 lines):

```jsx
import "leaflet/dist/leaflet.css";   // must come before index.css so overrides win
import "./index.css";
import App from "./App.jsx";
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode><App /></React.StrictMode>
);
```

`StrictMode` double-invokes effects in development — which is why every `useEffect` that fetches data uses an `AbortController` or an `isMounted` flag.

`App.css` (344 lines) is **never imported** anywhere; it is a leftover from the earlier non-map layout.

### 6.2 `App.jsx` — the application shell

1 225 lines. It is a single "god component": all cross-cutting state lives here, and child components are pure presentational consumers with callbacks. Two complete JSX trees are returned depending on `viewMode`.

#### 6.2.1 The API base URL and the forecast normaliser (lines ~30–72)

```js
const API = (import.meta.env.VITE_API_BASE_URL
             ?? (import.meta.env.DEV ? "http://127.0.0.1:8000" : ""))
            .replace(/\/$/, "");
```

- Explicit env var wins; otherwise in dev it hard-codes `127.0.0.1:8000`; in production it is `""` → same-origin (Vercel rewrite).
- `.replace(/\/$/, "")` prevents `//api/...` double slashes.

```js
function normalisasiPrakiraan(dataApi) {
  let daftar = [];
  if (Array.isArray(dataApi?.prakiraan))            daftar = dataApi.prakiraan;
  else if (Array.isArray(dataApi?.data?.prakiraan)) daftar = dataApi.data.prakiraan;
  else if (Array.isArray(dataApi?.cuaca))           daftar = dataApi.cuaca.flat(Infinity);
  else if (Array.isArray(dataApi))                  daftar = dataApi;

  return daftar.filter(i => i && typeof i === "object").map(item => ({
    ...item,
    waktu_lokal: (item.waktu_lokal || item.datetime || item.waktu || null)?.replace?.("T"," ") || null,
    suhu_c: item.suhu_c ?? item.suhu ?? item.temperature ?? null,
    kelembapan_persen: item.kelembapan_persen ?? item.kelembapan ?? item.humidity ?? null,
    kondisi: item.kondisi || item.weather_desc || item.cuaca || "Berawan",
  }));
}
```

A tolerant adapter: it accepts our own `{prakiraan:[…]}` envelope, a nested `{data:{prakiraan:[…]}}`, the **raw BMKG** shape `{cuaca:[[{…}]]}` (flattened with `flat(Infinity)`), or a bare array — then canonicalises the four field names it uses. `??` (not `||`) for numbers so `0 °C` survives; `||` for strings so empty strings fall through. `?.replace?.("T"," ")` converts ISO `2026-10-16T15:00:00` to `2026-10-16 15:00:00`, which every consumer later `.split(" ")`s into date + time. This is the seam that would let the app talk directly to BMKG later without touching the UI.

#### 6.2.2 State inventory

| State | Type / default | Purpose |
|---|---|---|
| `theme` | `"dark"` (from `localStorage.jenebosi_theme`) | dark/light; effect writes `data-theme` on `<html>` and persists |
| `viewMode` | `"mobile"` if `innerWidth < 768` else `"laptop"` | which of the two render trees is used |
| `geojson` | `null` | FeatureCollection of 153 kelurahan |
| `banjir` | `[]` | `/api/banjir` rows |
| `error` | `""` | fatal load error |
| `search` | `""` | free-text filter (shared with `FloodMap`) |
| `isSearchFocusedMobile` | `false` | mobile autocomplete visibility |
| `filter` | `"semua"` | `semua` / `rendah` / `sedang` / `tinggi` / `sangat_tinggi` |
| `selectedKelurahan` | `null` | object shown in the detail panel / bottom sheet |
| `prakiraan` | `[]` | normalised forecast list |
| `loadingPrakiraan`, `errorPrakiraan` | `false`, `""` | forecast UI state |
| `forecastRequestVersion` | `0` | bump-to-refetch counter |
| `isSimulation` | `false` | master switch: real-time vs. scenario |
| `simulationModalOpen`, `waterSimulatorOpen` | `false` | modal visibility |
| `simulationState` | `{activePreset:"normal", nama:"☀️ Skenario 1: Normal", rainMm:0, tideM:0.45, depthCm:0, riverOverflow:false, bufferM:200}` | scenario parameters |
| `activeRoute` | `null` | generated evacuation route object |
| `activeBufferRiver`, `bufferRadius`, `bufferToolOpen` | `"kanal-panampu"`, `250`, `false` | canal buffer tool |
| `facilityCategory` | `"semua"` | which critical-facility markers to show |
| `focusedPosko` | `null` | fly-to target |
| `activeSidebarMenu` | `null` | `ikhtisar` / `posko` / `fasilitas` / `cuaca` / `pasut` / `simulasi` / `panduan` / `tentang` (and dead ids `layer_kerawanan`, `kanal_buffer`, `simulator_air` — titles exist but no drawers) |
| `isSidebarCollapsed` | `true` | icon-only vs. labelled sidebar |
| `mobileModalActive` | `null` | `posko` / `fasilitas` / `cuaca` / `pasut` / `panduan` / `panduan_darurat` / `tentang` / `simulasi_kedalaman` / `buffer` |

Note `waterSimulatorOpen` is declared and passed to `WaterHeightSimulatorModal` in both trees, but **`setWaterSimulatorOpen(true)` is never called** — the modal is unreachable. `FloodDepthSimulator` is reached instead through the mobile drawer (`simulasi_kedalaman`).

#### 6.2.3 Effects

**(a) Initial data load (once, on mount)**

```js
const [resGeo, resBanjir] = await Promise.all([
  fetch(`${API}/api/kelurahan/geojson`),
  fetch(`${API}/api/banjir`),
]);
if (!resGeo.ok) throw new Error("Gagal mengambil batas wilayah kelurahan.");
...
banjirData = Array.isArray(bJson) ? bJson : bJson.data || [];
```

- Polygons and risk rows load in parallel.
- **Failure policy is asymmetric:** a failing `/api/kelurahan/geojson` is fatal (sets `error`, map shows the loading state forever); a failing `/api/banjir` is silently tolerated → the map renders all polygons grey (`belum`).
- Cleanup sets `isMounted = false` so a late response after unmount doesn't warn (StrictMode double-mount).

**(b) Forecast fetch on selection**

```js
const kodeWilayah = selectedKelurahan?.kode_wilayah;
if (!kodeWilayah) { setPrakiraan([]); ... return; }

const controller = new AbortController();
for (const url of [`${API}/api/bmkg/prakiraan/${kode}`, `${API}/api/prakiraan/${kode}`]) {
  const response = await fetch(url, { signal: controller.signal });
  if (!response.ok) continue;
  const daftar = normalisasiPrakiraan(await response.json());
  if (daftar.length > 0) { setPrakiraan(daftar); return; }
}
setErrorPrakiraan("Prakiraan BMKG untuk kelurahan ini belum tersedia. ...");
```

- Dependency array is `[selectedKelurahan?.kode_wilayah, forecastRequestVersion]` — deliberately keyed on the **code**, not the object, so re-selecting the same kelurahan with different risk numbers does not refetch.
- Two candidate URLs are tried in order (`/api/bmkg/prakiraan/{kode}` then `/api/prakiraan/{kode}`) — both exist server-side, so the second only matters for older deployments.
- `AbortController` cancels the in-flight request when the selection changes; `err.name !== "AbortError"` filters the expected cancellation from real errors.
- `handleRefreshPrakiraan` bumps `forecastRequestVersion` to force a retry from the "Coba lagi" buttons.
- An empty-but-successful response is treated as an error, with citizen-friendly copy ("belum tersedia. Coba perbarui beberapa saat lagi").

**(c) Responsive auto-switch (debounced 200 ms)**

```js
if (isMobileScreen && current === "laptop" && innerWidth < 640) return "mobile";
if (!isMobileScreen && current === "mobile" && innerWidth >= 1024) return "laptop";
```

Hysteresis: it will only *force* mobile below 640 px and only *force* back to laptop above 1024 px. Between 640–1024 px whatever the user picked sticks — which avoids the classic "oscillating layout" bug.

#### 6.2.4 Derived data (memoised)

**(a) `daftarKelurahan`** — flattens the FeatureCollection into `{id, nama_kelurahan, kode_wilayah, feature}`. `feature` is kept so routing can read raw geometry. Used by search dropdowns and by `handleShowRoute` fallbacks.

**(b) `searchResultsMobile`** — first 6 name matches, only when the query is ≥ 2 chars.

**(c) `summary` — the four risk counters.** Two completely different implementations:

*Simulation mode:*

```js
geojson.features.forEach((f) => {
  const nama = (f.properties.nama_kelurahan || "").toLowerCase();
  const e = 5;                                        // ← constant placeholder
  const isCoastal = e < 4.5 || ["mariso","tallo","buloa","gusung","camba berua","ujung tanah"].some(k => nama.includes(k));
  const isBasin   = ["antang","manggala","tamalanrea","tamangapa","karunrung"].some(k => nama.includes(k));

  if (rain >= 120 || (rain >= 70 && tide >= 1.35) || (isCoastal && tide >= 1.45)) st++;
  else if (rain >= 60 || (isBasin && rain >= 40) || (isCoastal && tide >= 1.15))    t++;
  else if (rain >= 25 || tide >= 1.0)                                             s++;
  else                                                                           r++;
});
```

`const e = 5;` is a stubbed elevation — the `e < 4.5` branch is dead, so "coastal" in the *summary* is purely name-based. (The per-polygon `getFeatureRisk` in `FloodMap` does it properly with real elevation, so the legend counts and the map colours can disagree in simulation mode. This is a real inconsistency; see §9.)

*Real-time mode:* count `item.tingkat` strings with `includes()`:

```
"sangat" | "ekstrem"      → sangat_tinggi
"tinggi" | "siaga"        → tinggi
"sedang" | "waspada"      → sedang
anything else             → rendah        ← note: unknown/empty counts as "Aman"
```

The string matching is intentionally tolerant of both the model's vocabulary (`Rendah/Sedang/Tinggi/Sangat Tinggi`) and the UI vocabulary (`Aman/Waspada/Siaga/Bahaya`).

#### 6.2.5 `handleSelectKelurahan(item)` — the central selection handler

Called by the header autocomplete, the mobile autocomplete, the quick-pick pills, and the "quick pick" buttons inside the simulator. **It is *not* what a polygon click uses** (see §9).

```js
const feat = geojson?.features.find(f => f.properties.id === item.id);
const b    = banjir.find(x => x.kelurahan_id === item.id || x.nama_kelurahan === item.nama_kelurahan);

const isCoastal = ["mariso","tallo","buloa","gusung","camba berua","ujung tanah","tanjung merdeka"]
                    .some(k => lowerName.includes(k));
const rain = simulationState.rainMm ?? 0;
const tide = simulationState.tideM ?? 0.45;
const baseIndex = Number(b?.indeks_kerawanan) || 250;

const depth = clamp(0, 150, round5(
    (rain/180)*75 + ((tide-0.3)/1.5)*30
    + clamp(0, 20, (baseIndex-180)/12)
    + (isCoastal ? 10 : 0)
));

const simulatedLevel = rain >= 120 || (rain >= 70 && tide >= 1.35) || (isCoastal && tide >= 1.45) ? "Bahaya Ekstrem (Simulasi)"
                     : rain >= 60  || (isCoastal && tide >= 1.15)                            ? "Siaga Banjir (Simulasi)"
                     : rain >= 25  || tide >= 1.0                                            ? "Waspada (Simulasi)"
                     :                                                                          "Aman (Simulasi)";
```

The simulated depth is a **weighted sum of four normalised terms**, each capped:

| term | max contribution | meaning |
|---|---|---|
| `(rain/180)*75` | 75 cm | rainfall saturation at 180 mm/day |
| `((tide−0.3)/1.5)*30` | 30 cm | tide above 0.3 m datum, saturating at 1.8 m |
| `clamp(0,20,(baseIndex−180)/12)` | 20 cm | the kelurahan's static susceptibility |
| `isCoastal ? 10 : 0` | 10 cm | coastal exposure bonus |

then clamped to 0–150 cm and snapped to 5 cm. With the "katastrofik" preset (rain 140, tide 1.58, baseIndex 250, coastal): `58.3 + 25.6 + 5.8 + 10 = 99.8 → 100 cm`.

The object written to `selectedKelurahan`:

```js
{ id, nama_kelurahan, kode_wilayah, kecamatan,
  tingkat, estimasi_kedalaman_cm, kondisi_bmkg, waktu_analisis, feature }
```

with `tingkat`/`estimasi_kedalaman_cm`/`kondisi_bmkg`/`waktu_analisis` swapped for simulated values when `isSimulation` is on (`waktu_analisis` becomes `new Date().toISOString()`). Downstream components therefore need zero simulation awareness for the basic numbers.

#### 6.2.6 `handleShowRoute(kelurahanItem, poskoItem)`

```js
let startCoords = [-5.1477, 119.4327];                       // Karebosi-ish city centre fallback
if (geom.type === "Polygon")       startCoords = [c[0][0][1], c[0][0][0]];
else if (geom.type === "MultiPolygon") startCoords = [c[0][0][0][1], c[0][0][0][0]];
```

It takes the **first vertex of the first ring** of the polygon as the origin — i.e. an arbitrary boundary vertex, not the centroid or a road point. Cheap, deterministic, and visually "inside/near" the kelurahan, but it can land on a corner far from the settlement. A `PointOnSurface`/centroid would be better.

Destination: the explicit `poskoItem`, else the first posko whose `kecamatan` string contains the kelurahan's `kecamatan`, else `POSKO_EVAKUASI_MAKASSAR[0]`. Then:

```js
const generated = generateJalurEvakuasi(startCoords, destCoords, isSimulation ? simulationState : null);
setActiveRoute({ ...generated, originName: `Kel. ${…}`, targetPosko });
document.getElementById("peta")?.scrollIntoView({ behavior: "smooth" });
```

`handleStartRouteToFacility(facility)` is the same idea with a critical-facility destination.

#### 6.2.7 `handleResetSimulation()`

Restores the canonical "normal" scenario object **by duplicating the literal** (it is not imported from `SimulationController.PRESET_SKENARIO`), sets `isSimulation=false`, and closes the modal. Risk of drift between the two literals.

#### 6.2.8 Render tree 1 — mobile (`viewMode === "mobile"`)

```
.mobile-view-wrapper
├── .mobile-top-bar
│   ├── .mobile-bar-main: logo + JeneBosi wordmark, search pill (+ dropdown), theme chip, "Laptop" chip
│   └── .mobile-scroll-chips: Semua/Aman/Waspada/Siaga/Bahaya counts, Simulasi,
│       Pasang Surut, Cuaca BMKG, Posko (n), Fasilitas, Darurat 112, Panduan Siaga, Tentang Data
├── .mobile-fullscreen-map  → <FloodMap ... publicMode />
├── <MobileBottomSheet>  (when a kelurahan is selected)
├── <MobileDrawerModal> × 8  (posko, darurat, fasilitas, simulator, panduan, cuaca, pasut, tentang)
├── <SimulationController>
└── <WaterHeightSimulatorModal>   (never opens)
```

The horizontal chip bar is the mobile "navigation": each chip either sets `filter` or opens a modal. `badge` is computed once with `getRiskBadge(selectedKelurahan.tingkat)` and handed to the bottom sheet.

#### 6.2.9 Render tree 2 — laptop / desktop

```
.webgis-app-root.full-screen-dashboard
├── <AppHeader>            glass floating header: brand, search + dropdown, theme, mode toggle,
│                          and the five category chips with counts
├── <DockedSidebar>        vertical icon rail (8 items) + collapse toggle
├── <SidebarFeatureDrawer> right-hand panel, title chosen by a long ternary chain on activeSidebarMenu
│      ├── ikhtisar        : 4 stat cards + quick-pick pills (Antang, Manggala, …)
│      ├── posko           : 12 posko cards, each with "Fokus" and "Buat Rute" buttons
│      ├── fasilitas       : category radio list (+ "hide all")
│      ├── cuaca           : <RainfallInsight>
│      ├── pasut           : <TideMonitorWidget>
│      ├── simulasi        : open-simulation button + "turn off" button
│      ├── panduan         : <CitizenSafetyGuide> + <PreparednessChecklist>
│      └── tentang         : <DataSourceInfo>
├── <main class="fullscreen-map-canvas">
│      ├── <FloodMap>      (all map layers, all overlays, and its own floating cards)
│      ├── .floating-selected-overlay → <SelectedAreaPanel>  (when selected)
│      └── .map-bottom-center-action → "Info Lainnya ↓" / "Tutup Panel ↑"
├── <SimulationController>
└── <WaterHeightSimulatorModal>
```

Menu ids that appear in the title ternary (`layer_kerawanan`, `kanal_buffer`, `simulator_air`) have **no corresponding drawer body**, so selecting them would render an empty panel. They are not in `SIDEBAR_ITEMS`, so they're unreachable in practice — dead branches.

### 6.3 Components, one by one

#### `AppHeader.jsx` (171 lines)
Props: `search, onSearchChange, daftarKelurahan, onSelectKelurahan, viewMode, onToggleMode, theme, onToggleTheme, filter, onFilterChange, summary`.
- Local state `isSearchFocused` (dropdown visibility) and `mobileMenuOpen` (**unused**).
- Autocomplete: `search.trim().length >= 2` → filter by case-insensitive substring → `slice(0, 8)`.
- Uses `onMouseDown` (not `onClick`) on results, because the input's `onBlur` closes the dropdown 200 ms later; `onMouseDown` fires before blur, so the click is not swallowed. A classic, correct detail.
- Five chips with live counts from `summary`; the active chip gets `.active` for styling. On `onToggleMode` the label shows the *current* mode ("Laptop"/"HP") rather than the target — mildly confusing copy.

#### `DockedSidebar.jsx` (68 lines)
Exports `SIDEBAR_ITEMS` (8 entries `{id, label, icon}`) and the component. Renders a collapse toggle and the icon rail; when `isCollapsed` the text labels are omitted and an active indicator bar is shown. Purely presentational.

#### `SidebarFeatureDrawer.jsx` (31 lines)
Returns `null` when `activeMenu` is falsy; otherwise a fixed-region `role="dialog"` with a header (title + close) and a scroll container. No focus trap, no Escape handler, no backdrop.

#### `FloodRiskLegend.jsx` (96 lines)
Bottom-left legend with two sections: the four risk colours with live counts, and the marker symbols (posko/RS/BPBD/SPBU). Starts collapsed on screens ≤ 768 px (`useState` initialiser reading `window.innerWidth`) and toggles on header click.

#### `SelectedAreaPanel.jsx` (250 lines)
Desktop detail panel. Exports `getRiskBadge(tingkatStr)` — the single source of truth for risk vocabulary:

| matched in `tingkat` | key | label | colour |
|---|---|---|---|
| `sangat`, `ekstrem` | `sangat_tinggi` | "Bahaya Ekstrem" | `#EF4444` |
| `tinggi`, `siaga` | `tinggi` | "Siaga Banjir" | `#F97316` |
| `sedang`, `waspada` | `sedang` | "Waspada" | `#F59E0B` |
| `rendah`, `aman` | `rendah` | "Aman Berdasarkan Data Tersedia" | `#10B981` |
| otherwise | `belum` | "Data Belum Tersedia" | `#64748B` |

Each badge carries `{key,label,color,bg,border,desc}`. The component shows: eyebrow + name + kecamatan, a coloured risk hero, a two-tab switcher (**Ikhtisar** / **Prakiraan Cuaca**), and per tab:
- *Ikhtisar*: `<CitizenActionHub>` (kept outside the scroll area on laptop so it's always visible), `<FloodDepthEstimate>`, an "Apa Artinya bagi Saya?" bullet list generated by `getMeaningForUser()`, and a fixed recommendation list (monitor BMKG, protect documents, keep children away from drains, save 112).
- *Cuaca*: loading / error / empty / populated states; up to 8 forecast mini-cards that derive time and date by splitting `waktu_lokal` on `" "`, an emoji from keywords, temperature, condition and humidity; a disclaimer that this is a **forecast**, not an observation.

`getMeaningForUser()` is written to avoid false precision: it always appends *"Ketinggian genangan aktual belum tersedia dari sensor di titik ini. Hindari menyimpulkan kedalaman air tanpa pengamatan lapangan."*

#### `CitizenActionHub.jsx` (115 lines)
A collapsible action drawer inside the detail panel. Behaviour:
- **Saved areas**: `localStorage["webgis2mbc_saved_kelurahan"]` holds an array of `kode_wilayah`; toggling uses a `Set` to dedupe and is wrapped in `try/catch` (private-mode Safari throws).
- **Nearest shelter**: first posko whose `kecamatan` contains the kelurahan's `kecamatan` (string match, not distance), else `POSKO[0]`.
- **Share**: `navigator.share()` when available, swallowing `AbortError`; otherwise opens `api.whatsapp.com/send?text=…` in a new tab.
- **Report flooding**: a `<select>` of four levels ("Belum ada genangan", "Setinggi mata kaki", "Setinggi lutut", "Setinggi pinggang atau lebih") → builds a message with `toLocaleString("id-ID")` and hands it to the same share path. **Nothing is POSTed to the server** — the UI copy says explicitly that the report is opened in the share sheet "agar dapat diteruskan ke kanal warga atau petugas" (so a human can forward it).

#### `FloodDepthEstimate.jsx` (34 lines)
Compact card: `depthCm` big number + metres, a decorative water column whose height is `clamp(12,100, depthCm)%`, the `getDepthImpact` label/advice band, and an embedded `<FloodDepthVisualization showHeader={false} showImpactCards={false}>` (the human-scale SVG). Optionally shows `kondisi_bmkg` and a localised `waktu_analisis`.

#### `FloodDepthVisualization.jsx` (454 lines) — the human-scale figure
Exports `getDepthImpact(depthCm)` (the impact model) and the component.

Impact bands (severity, label, colour, pedestrian / children / motorcycle / car text, advice):

| depth | severity | label | colour |
|---|---|---|---|
| ≤ 0 | aman | "Kering / Tidak Ada Genangan" | `#2F855A` |
| ≤ 15 | rendah | "Genangan Dangkal (Semata Kaki)" | `#2F855A` |
| ≤ 35 | waspada | "Genangan Sedang (Sebetis Dewasa / Selutut Anak)" | `#D69E2E` |
| ≤ 60 | tinggi | "Genangan Tinggi (Selutut Dewasa / Sepinggang Anak)" | `#DD6B20` |
| ≤ 100 | ekstrem | "Banjir Serius (Sepinggang Dewasa / Menenggelamkan Anak)" | `#C53030` |
| > 100 | bencana | "Banjir Ekstrem / Bandang (Sedada Dewasa ke Atas)" | `#7F1D1D` |

The SVG geometry is a small, well-commented coordinate system:

```js
svgHeight = 320, groundY = 280, rulerHeight = 250, pxPerCm = 250/200 = 1.25
waterY      = groundY - depth*1.25
adultHeight = 170*1.25 = 212.5 px   (adult ≈ 170 cm)
childHeight = 110*1.25 = 137.5 px   (child ≈ 110 cm)
```

Draw order: background rect → dashed horizontal guides every 50 cm with labels → vertical ruler with major/minor ticks → adult figure → child figure → water body with a gradient + glow filter → surface line. `preserveAspectRatio="xMidYMid meet"` keeps proportions on any screen; `role="img"` + a descriptive `aria-label` including the depth makes it screen-reader friendly. Depth is clamped to 200 cm (the top of the ruler).

#### `FloodDepthSimulator.jsx` (268 lines)
Exports `getTypicalFloodDepth(kelurahan, isSimulation, simulationState)` and the component.

Resolution order for the "typical" depth:
1. `kelurahan.kedalaman_air_cm` if present (a sensor field that **no endpoint supplies** — a hook for future AWLR integration);
2. simulation: `simBase = simulationState.depthCm ?? 40`, scaled by the risk string — `sangat/ekstrem → ×1`, `tinggi/siaga → ×0.7`, `sedang/waspada → ×0.4`, else `×0.1`;
3. a hard-coded name/elevation lookup: Antang & Tamangapa 85 cm; Camba Berua/Buloa/Tallo 65; Mariso/Mattoanging 50; then `sangat 75 / tinggi 45 / sedang 20 / else 0`.

That name list is a hand-curated "known flood hot-spots" table inside JavaScript — honest but unscientific, and it is the only place those numbers exist.

Component: two modes — **Otomatis** (follows `selectedKelurahan`, with an effect that snaps back to auto whenever the selection changes) and **Kustom** (a 0–200 cm slider in 5 cm steps plus six preset chips: 0/15/35/60/100/150 cm). Renders `<FloodDepthVisualization>` and a safety note.

#### `RainfallInsight.jsx` (156 lines)
The BMKG forecast presenter. Takes up to 8 normalised items, has an interval selector (`selectedInterval`), shows a "current/selected" hero card (condition emoji, temperature, location tag, humidity, "today's rain" status from the `hujanTerbaru` prop — **always passed as `0` by App, so it always says "0 mm (Kering)"**), a horizontally scrollable 3-hourly timeline, four BMKG rainfall-threshold cards (0.5–20 / 20–50 / 50–100 / >100 mm per day), and an integrity note stressing that these are numerical forecasts.

#### `TideMonitorWidget.jsx` (222 lines)
Owns its data fetching (the only component besides App that talks to the API):

```js
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? "http://127.0.0.1:8000" : "")).replace(/\/$/, "");
```

- `fetchMarineData` is a `useCallback` hitting `/api/maritim/pasut`, and on any failure installs a **client-side copy of the same offline fallback object** the backend returns (duplicated literal → two places to keep in sync).
- Auto-refresh every 5 minutes via `setInterval` with cleanup; manual refresh button.
- Renders: live/loading tag, big height badge coloured by `status_rob` (`ekstrem` red, `waspada` amber, else green), station + `waktu_wita`, the status description, four oceanographic metric cards (wave height, current velocity, wave period, astronomical elevation), the 4-slot daily tidal schedule, a static list of six rob-prone coastal kelurahan, and an explainer on compound flooding ("hujan lebat di hulu + pasang > 1.30 m → pintu air ditutup, genangan lebih lama surut").
- `onFilterCoastal` is wired by App to `setSearch("Mariso")` — a shortcut that filters the map to Mariso rather than truly highlighting all coastal kelurahan.

#### `SimulationController.jsx` (269 lines)
Exports `PRESET_SKENARIO` (4 presets) and the modal.

| preset | rainMm | tideM | depthCm | riverOverflow | bufferM |
|---|---|---|---|---|---|
| `normal` — "☀️ Skenario 1: Normal / Kemarau" | 0 | 0.45 | 0 | false | 100 |
| `hujan_lebat` — "🌧️ Skenario 2: Hujan Monsun Lebat" | 65 | 1.05 | 45 | false | 200 |
| `pasut_rob` — "🌊 Skenario 3: Puncak Pasang Rob Pesisir" | 20 | 1.52 | 55 | true | 300 |
| `katastrofik` — "🚨 Skenario 4: Banjir Majemuk Katastrofik" | 140 | 1.58 | 110 | true | 500 |

UI: a two-pill mode switch (real-time vs simulation; clicking real-time calls `onResetRealtime`), a preset grid, three custom sliders (rain 0–180 step 5; tide 0.30–1.80 step 0.05; buffer 50–800 step 50), an academic-explanation banner, and footer buttons (reset / "apply and view on map"). Touching any slider sets `activePreset: "custom"` and auto-enables simulation — a nice touch: the user cannot configure a scenario and see nothing happen.

Note `bufferM` and `riverOverflow` are **stored but never consumed**: `FloodMap` reads `bufferRadius` from App state (driven by `RiverBufferTool`), not from `simulationState.bufferM`. Dead parameters.

#### `RiverBufferTool.jsx` (148 lines)
Given the selected waterway id, shows a dropdown of the six waterways, 100/250/500 m chips, and a table of affected kelurahan with a distance phrase and a risk chip. The table is **static data** (`KELURAHAN_SEMPADAN_KANAL`) keyed by river id — it does *not* recompute from the buffer geometry, which is why the heading says "Kelurahan Masuk Zona Sempadan" without changing counts when the radius changes. Clicking a row calls `onHighlightKelurahan(nama)` → App sets `search` to that name (a filter shortcut, not a selection). Footer disclaimer: *"bukan batas hukum, peta genangan, atau hasil model hidrodinamika."*

#### `EvacuationRouteCard.jsx` (114 lines)
Presents `routeData` (`jarakKm`, `waktuKendaraanMenit`, `waktuJalanKakiMenit`, `advisories`, `googleMapsUrl`), origin name and target posko. Two big buttons: open Google Maps directions and `tel:` the posko (digits extracted with `replace(/[^0-9]/g,"")`, defaulting to `112`). Eyebrow switches to "🧪 SKENARIO EVAKUASI SIMULASI" in simulation mode.

#### `MobileBottomSheet.jsx` (217 lines)
The mobile counterpart of `SelectedAreaPanel`, with a three-position state machine `peek → half → expanded` cycled by tapping the drag handle (no real drag gestures). Three tabs: **Ikhtisar** (risk box, "what it means", `<CitizenActionHub>`), **Ketinggian Air** (`<FloodDepthEstimate>` + a button to open the simulator), **Cuaca BMKG** (loading/error/empty/list). Reads `badge` as a prop (App computes it) unlike the desktop panel which computes its own — a small duplication.

#### `MobileDrawerModal.jsx` (36 lines)
Generic bottom-ish modal: returns `null` when closed, overlay click closes, inner content stops propagation, header with title + close, scrollable body.

#### `WaterHeightSimulatorModal.jsx` (33 lines)
Centred modal wrapping `<FloodDepthSimulator isSimulation={false}>`. **Unreachable** (see §9).

#### `CitizenSafetyGuide.jsx` (185 lines)
Static 3-phase emergency protocol (`GUIDE_PHASES`): **FASE 1 saat hujan lebat** (check status, protect documents, watch drains), **FASE 2 saat air naik** (kill MCB + gas, evacuate vulnerable people, don't cross fast water), **FASE 3 evakuasi** (find nearest posko, call 112, register with RT/RW). Each phase has 3 steps with `{no,title,desc,action}`. Rendered as tabs + numbered step cards + an emergency CTA row (`tel:112` and a pre-filled WhatsApp deep link to BPBD).

Inconsistency: step text says *"30 lokasi posko pengungsian resmi"* while the data file defines **12**.

#### `PreparednessChecklist.jsx` (257 lines)
13-item, 3-category checklist (`pra` / `saat` / `pasca`), persisted in `localStorage["webgis2mbc_checklist_state"]` as an array of ids. Progress bar with colour that shifts at 50 % and 100 %, a reset button guarded by `window.confirm`, keyboard-accessible cards (`role="checkbox"`, `tabIndex`, Enter/Space), an emergency 112 banner, and a disclaimer that completing the list does not guarantee safety.

#### `DataSourceInfo.jsx` (162 lines)
The "about / methodology" page: four source cards (BMKG forecast; Copernicus DEM GLO-90 + Open-Meteo elevation; boundaries & basemaps; BPBD/BNPB guidance), a **risk-category definition table** that expresses each class in elevation terms (Aman > 12 m dpl; Waspada 8–12 m; Siaga 3–8 m; Bahaya < 3 m), an honest limitations banner (explicitly *not* an AWLR sensor system; depths are "ilustratif edukatif"), and a credits footer naming the three authors.

Worth flagging: the elevation-based definitions here are *narrative*, not the actual classifier. The real label comes from `calculate_risk()`'s 100–500 index (§5.3), which mixes five parameters. A kelurahan at 2 m dpl with high land-use score can be "Tinggi" rather than "Bahaya", so the table should be read as illustrative.

#### `IntroSection.jsx` (74 lines)
A marketing hero (`"Kenali Risiko Banjir di Sekitarmu"`, CTA to scroll to `#peta`, stat pills for the four categories). **Not imported anywhere** — dead code from the pre-map layout.

#### `JeneBosiLogo.jsx` (108 lines)
Parametric inline SVG logo (`size` prop): a shield with a dark gradient and tri-colour border, a teal river-wave path, a cyan rain-drop path with a glow filter, a white highlight, and a dashed "radar/GIS coordinate" ring. The comment block documents the design philosophy (shield = protection, drop = *bosi* rain, waves = *jene'* water, ring = GIS). Uses fixed SVG `id`s — fine while only one instance renders, but two logos on the same page would collide (`url(#jb-glow)` references resolve to the first match). App renders it twice on mobile (header brand) — actually once per tree, so OK in practice.

#### `Icons.jsx` (420 lines)
43 tiny function components, each an inline `<svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>` with a `size` prop (default varies) and `color` defaulting to `"currentColor"`. Feather-style geometry, zero dependency, tree-shakeable. Several are imported but unused (e.g. `IconCompass`, `IconFlask` in App; `IconLayers`, `IconOpacity`, `IconCompare`, `IconTarget`, `IconLocation` in FloodMap).

#### `FloodMap.jsx` (1 092 lines) — the map engine

Props (all optional except `geojson`/`onSelectKelurahan`): map data (`geojson`, `banjirData`, `elevasiData`, `hujanData`), selection, search/filter, `summary`, simulation (`isSimulation`, `simulationState`, `onOpenSimulation`, `onResetSimulation`), route (`activeRoute`, `onClearRoute`, `onStartRouteToFacility`), buffer (`activeBufferRiver`, `bufferRadius`, `onChangeBufferRiver`, `onChangeBufferRadius`, `bufferToolOpen`, `onToggleBufferTool`), facilities (`facilityCategory`, `onChangeFacilityCategory`), `publicMode`, `focusedPosko`.

**Module-level helpers**

- `createPoskoIcon(kategori)` / `createFacilityIcon(kategori)` → `L.divIcon` with a coloured circular HTML badge and an emoji (red 🏥 for health, green ⛺ for shelter, orange 🚒 BPBD, green 🕌 worship, blue ⛽ fuel). `iconAnchor`/`popupAnchor` aligned to the centre.
- Leaflet default-icon fix: deletes `L.Icon.Default.prototype._getIconUrl` and re-points the three marker PNGs at `unpkg.com` — the standard workaround for Vite breaking Leaflet's relative asset paths. (Adds a runtime dependency on unpkg.)
- `BASEMAPS` — a **single** basemap object: Esri *World Dark Gray Base* + *Dark Gray Reference* label tiles, with attribution. There is no light basemap and no layer switcher, despite `IconLayers` being imported.
- `RISK_COLORS` — the one palette used by fill, tooltip dot and legend: `rendah #10B981`, `sedang #F59E0B`, `tinggi #F97316`, `sangat_tinggi #EF4444`, `belum #64748B`.
- `buildRiverBufferGeoJson(lineCoordinates, radiusMeters)` — **the most interesting geometry code in the frontend.** For each consecutive vertex pair it computes local metres-per-degree (`110 540` for latitude, `111 320·cos(lat)` for longitude), the segment vector `(dx,dy)`, its length, the unit normal `(-dy, dx)/L`, and offsets that normal by `radius` metres, then emits a **quadrilateral** (offset-p1, offset-p2, −offset-p2, −offset-p1, close). The union of quads approximates a corridor. It is a *locally flat* approximation (fine at city scale, wrong near the poles), produces a separate polygon per segment (so the corridor is a FeatureCollection of overlapping quads rather than one dissolved buffer), and does not round the caps or mitre the joints. The code comments call it "zona indikatif" — and it is. A true buffer would need Turf/`jsts` or a server-side `ST_Buffer`.
- `MapResetFocus`, `SelectedFocus`, `UserLocationFocus`, `PoskoFocus` — four tiny `useMap()` components that fly/fit the camera when a trigger prop changes, each wrapped in `try/catch` because Leaflet throws on invalid bounds.
- `MapResizeHandler` — `map.invalidateSize()` on window resize plus two timeouts (150 ms and 500 ms) after mount, to survive CSS layout transitions.
- `MapCompareController` — creates a `rightBasemapPane` (z-index 250) and applies `clip-path: inset(0 0 0 X%)` to it and to `overlayPane`, so everything right of the divider shows the basemap while everything left shows polygons. Elegant, and dead in practice (§9).

**Local state**: `layerOpacity` (0.65), `resetCount`, `userLocation`, `locatingUser`, `toastMsg`, `showPosko` (true), `showKanal` (false), `compareMode` (false), `comparePos` (50), `isDragging`, `mapFrameRef`.

**Derived lookups** — three `Map` objects built from props, each keyed **twice** (by `kelurahan_id` and by `nama_kelurahan`) so a lookup succeeds whichever identifier the caller has:

```js
banjirMap  : id|name → whole row
elevasiMap : id|name → elevasi_titik_m
hujanMap   : id|name → nilai_mm
```

`elevasiData` and `hujanData` default to `[]` and **App never passes them**, so they are always empty — meaning `elev` is `null` in every call (see the `isCoastal` bug in §9).

**`getFeatureRisk(props)`** — the risk resolver, mirroring `handleSelectKelurahan` but per-polygon:

*Simulation:* real `elev` (when available) drives `isCoastal = elev < 4.5 || nameMatch`; same thresholds as App; returns `{tingkatKey, rawTingkat, elevasi, hujan: simRain, estimasiKedalamanCm, kondisiBmkg, waktuAnalisis: now}`. The depth formula is identical to App's (`(simRain/180)*75 + ((simTide-0.3)/1.5)*30 + clamp(0,20,(baseIndex-180)/12) + (isCoastal?10:0)`, clamped 0–150, snapped to 5).

*Real-time:* normalises `b.tingkat` into a `tingkatKey` (`sangat`/`ekstrem` → `sangat_tinggi`, etc.), defaults to `belum` when there is no row at all.

**`filteredGeojson`** — filters by name substring *and* by risk key (calling `getFeatureRisk` per feature). Consequence: with a category filter active, the map physically hides non-matching polygons (it does not just dim them).

**`featureStyle(feature)`** — selected polygon: teal `#176B65` 3.5 px border, fill opacity `min(0.85, layerOpacity+0.2)`; others: white 1.5 px border at 0.9 opacity, fill at `layerOpacity`.

**`onEachFeature(feature, layer)`** — click handler unbinds the tooltip (so a selected polygon doesn't keep showing it) and calls `onSelectKelurahan({...props, feature, tingkat: rawTingkat, elevasi_m, hujan_mm, estimasi_kedalaman_cm, kondisi_bmkg, waktu_analisis})`; hover thickens/teals the border and reverts on mouseout (only when not selected); a sticky HTML tooltip shows a colour dot + name + raw level.

**Layers rendered inside `<MapContainer center={[-5.1477, 119.4327]} zoom={12} zoomControl={false}>`** (Karebosi / city-centre coordinate, zoom 12):

1. Controller components (`MapCompareController`, `MapResizeHandler`).
2. Two `TileLayer`s (base + reference labels).
3. `GeoJSON` choropleth with a **composite React `key`**: `` `geojson-${filter}-${search}-${layerOpacity}-${selectedKelurahan?.id}-${isSimulation ? JSON.stringify(simulationState) : "real"}` ``. Changing any of those force-remounts the whole GeoJSON layer — that is how restyling is achieved, because react-leaflet's `style` prop only applies to *new* layers. Cost: every keystroke in the search box rebuilds 153 Leaflet layers (jank on low-end phones). A `key` on JSON.stringify also means a re-render on every slider pixel.
4. Camera controllers (`SelectedFocus`, `UserLocationFocus`, `PoskoFocus`, `MapResetFocus`).
5. **Buffer overlay** (when `bufferToolOpen`): the synthetic corridor `GeoJSON` in amber + the waterway `Polyline` in teal.
6. **Waterway layer** (`showKanal`) with tooltips and a click handler that selects that river for the buffer tool and opens it.
7. **Evacuation route**: dashed emerald `Polyline` through `activeRoute.waypoints` + two `divIcon` "📍 Mulai" / "⛺ Posko Aman" markers.
8. **Posko markers** (`showPosko`) — 12 `divIcon` markers whose `Popup` is a fairly rich card (category chip, name, address, capacity, contact, "🗺️ Rute Google Maps" deep link and a `tel:112` button).
9. **Critical-facility markers** — filtered by `facilityCategory` (`"none"` hides all, `"semua"` shows all), same popup pattern plus a "🚶‍♂️ Rute Evakuasi ke Sini" button calling `onStartRouteToFacility`.
10. **User GPS** `CircleMarker` (blue with white ring) when available.

**Overlays outside the map container** (absolutely positioned): the mandatory simulation banner (with "⚙️ Atur Parameter" and "✕ Reset Real-Time"), the floating `EvacuationRouteCard`, the floating `RiverBufferTool`, the bottom-right dock ("Lokasi saya", "Reset peta"/"Reset rute"), the `FloodRiskLegend`, the compare badges/divider/handle/pill, and a toast pill.

**GPS**: `handleDetectLocation` checks `navigator.geolocation`, sets `locatingUser`, calls `getCurrentPosition` with `{timeout: 10000, enableHighAccuracy: true}`, stores `[lat, lon]`, and toasts success/failure. `UserLocationFocus` then flies to zoom 14. Note: no permission-denied-specific message, and no reverse geocoding to a kelurahan.

**Dragging the compare divider**: `handleStartDrag` on the handle, then window-level `mousemove`/`touchmove` listeners while `isDragging`, converting `clientX - rect.left` into a percentage clamped to 5–95 %, with `preventDefault` on the pointer-down so text isn't selected.

### 6.4 Static data modules

#### `data/evakuasiDanKanal.js` (319 lines)

`POSKO_EVAKUASI_MAKASSAR` — **12** shelters, each:
```js
{ id: "posko-1", nama: "GOR Sudiang Makassar", kategori: "Posko Induk Pengungsian",
  kecamatan: "Biringkanaya", alamat: "...", latitude, longitude,
  kapasitas: 800, kontak: "0811-444-112 (BPBD Sudiang)",
  fasilitas: ["Tenda Pengungsian", ...], status: "Siaga 24 Jam" }
```
Spread across Biringkanaya, Manggala, Tamalanrea, Panakkukang, Mariso, Bontoala, Tallo. Header comment attributes them to BPBD/Dinas Sosial Kota Makassar. `kapasitas` is used in the UI; `fasilitas` is defined but never rendered.

`KANAL_DAN_SUNGAI_MAKASSAR` — a `FeatureCollection` of **six LineStrings** with rich properties (`id, nama, jenis, peran, panjang_km, muara, status, color, weight`):

| id | name | type | drawn colour |
|---|---|---|---|
| `sungai-jeneberang` | Sungai Jeneberang | main river | `#0369A1`, 6 px |
| `sungai-tallo` | Sungai Tallo | main river | `#0284C7`, 6 px |
| `kanal-jongaya` | Kanal Jongaya | primary canal | `#0EA5E9`, 4.5 px |
| `kanal-panampu` | Kanal Panampu | primary canal | default |
| `kanal-sinrijala` | Kanal Sinrijala | primary canal | default |
| `saluran-pampang` | Saluran Pampang | drain | default |

Coordinates are 6–7 hand-written vertices each — schematic centrelines, not surveyed geometry. They are good enough for the buffer demo and for orientation, and the code never claims otherwise.

#### `data/fasilitasKritis.js` (190 lines)

`KATEGORI_FASILITAS` — 5 filter chips (`semua`, `kesehatan`, `komando`, `ibadah`, `spbu`) with emoji + colour.

`DAFTAR_FASILITAS_KRITIS` — **12** facilities (4 health: RSUP Wahidin, RS Pelamonia, RSUD Daya, Puskesmas Kassi-Kassi; 3 command: BPBD/Damkar; 3 worship; 2 fuel), each with `{id, nama, kategori, kategoriLabel, alamat, kecamatan, latitude, longitude, kontak, elevasi, kapasitas, layanan[]}`. `elevasi` is a *string* ("14 m dpl (Aman Bebas Genangan)") — display-only, not used in any computation.

### 6.5 The routing utility

`utils/evacuationRouting.js` (72 lines) — **not** a real road-network router:

```js
export function hitungJarakKm(lat1, lon1, lat2, lon2) {  // Haversine, R = 6371 km
  ...
  return Number((R * c).toFixed(2));
}

export function generateJalurEvakuasi(origin, destination, floodScenario = null) {
  const straightDist   = hitungJarakKm(...);
  const actualRoadDist = Number((straightDist * 1.3).toFixed(2));   // detour factor
  const menitMobil     = Math.max(3, Math.round((actualRoadDist / 25) * 60));  // 25 km/h emergency
  const menitJalanKaki = Math.max(5, Math.round((actualRoadDist / 4)  * 60));  // 4 km/h walking

  const midLat1 = startLat + (endLat - startLat) * 0.35;
  const midLon1 = startLon + (endLon - startLon) * 0.15;
  const midLat2 = startLat + (endLat - startLat) * 0.75;
  const midLon2 = startLon + (endLon - startLon) * 0.85;
  const waypoints = [[startLat,startLon],[midLat1,midLon1],[midLat2,midLon2],[endLat,endLon]];
  ...
}
```

- Distance is great-circle × 1.3 (a standard urban detour/sinuosity factor).
- The polyline is an **orthogonal-ish staircase** through two interpolated points — it does not follow streets, rivers or bridges. The comment admits it "follows arterial patterns" and "avoids crossing rivers directly", which is aspirational rather than enforced.
- Advices: use arterial roads, abandon vehicles above ~30 cm, help vulnerable people first; plus a scenario warning prepended when `rainMm > 60 || tideM > 1.25`.
- `googleMapsUrl` is a real Google Maps directions deep link, which is the actual usable navigation output.

### 6.6 Styling system

`src/index.css` — 7 075 lines, hand-written, organised in ~60 commented sections, no preprocessor, no CSS modules, no Tailwind. Two layers:

**1. Design tokens as CSS custom properties** on `:root` (dark) and `[data-theme="light"]`:

```
--bg-main #0B1118   --bg-card #131C26   --bg-card-subtle #182230   --bg-surface #1E2B3C
--text-primary #F1F5F9  --text-secondary #94A3B8  --text-muted #64748B
--brand-primary #0EA5E9  --brand-primary-hover #0284C7  --brand-light  --brand-border #0369A1
--border-color #243242  --border-dark #334458
--risk-low/-caution/-high/-extreme/-nodata (+ matching -bg rgba tints)
--shadow-sm/-md/-lg   --radius-sm/md/lg/full
--font-family "Plus Jakarta Sans", "Inter", system-ui, …
```

The light theme redefines the same names, so **no component needs theme awareness** — only `<html data-theme>` changes (set by App's effect). Note the font stack references Plus Jakarta Sans/Inter without loading them (no `@font-face`/Google Fonts link), so it falls back to system UI fonts.

**2. Component/section styles** grouped by feature area, matching the comment banners: glass header, category chips, docked sidebar, sidebar drawer, fullscreen map canvas, Leaflet tooltip/popup cleanup (`clean-map-tooltip`, `clean-posko-popup`), floating selected panel, bottom-centre action pill, right-bottom dock, legend, hero/intro, safety guide, checklist, data-source, depth estimate, human-scale SVG, simulator, BMKG forecast tabs, rainfall card, tide widget, buffer tool, route card, mobile wrapper, mobile top island, mobile chips, mobile bottom sheet (`sheet-state-peek/half/expanded`), mobile modal, compare slider, dark-theme overrides for mobile cards, custom scrollbars.

Notable techniques used: `backdrop-filter: blur(...)` for glass panels, `env(safe-area-inset-*)` for notches, `100dvh` for mobile viewport correctness, `overflow-x: auto` + `scrollbar-width: none` for chip rails, `clip-path: inset()` for the map compare, `@keyframes` pulses for the simulation banner and live dot, and extensive `rgba(255,255,255,0.06–0.12)` borders for the dark cartographic look.

There is visible duplication: several blocks are re-declared for the mobile tree and again for the modal tree (e.g. "Penyesuaian tema Dark Cartographic untuk seluruh card di dalam modal mobile"), and one section header is literally duplicated ("Reset Scrollbar Horizontal di Komponen Dalam Drawer" appears twice at lines 519). `App.css` is a third, unused copy of older styles.

---

## 7. End-to-end interaction flows

### 7.1 Page load → coloured map

1. `index.html` → `main.jsx` → `App` mounts (twice in dev due to StrictMode).
2. `useEffect` (a) fires two parallel `fetch`es: `/api/kelurahan/geojson`, `/api/banjir`.
3. Backend runs `ST_AsGeoJSON` over `kelurahan` and joins `potensi_banjir ⋈ kelurahan`.
4. `setGeojson` / `setBanjir` → `daftarKelurahan` and `summary` recompute.
5. `FloodMap` receives `geojson`; before that it renders `.map-loading-state` ("⏳ Sedang memuat batas 153 kelurahan Kota Makassar...").
6. `MapContainer` mounts → `MapResizeHandler` invalidates size twice → Esri dark tiles stream in → `GeoJSON` builds 153 layers, each styled by `featureStyle` (fill = risk colour, opacity 0.65) and given a sticky tooltip.
7. `FloodRiskLegend` shows counts; `AppHeader` chips show the same numbers.

### 7.2 Click a polygon

1. Leaflet fires `click` on the polygon layer → `onEachFeature`'s handler unbinds the tooltip and calls `onSelectKelurahan({...})`.
2. Desktop: App's inline callback `setSelectedKelurahan(kel)` + `setActiveSidebarMenu(null)`. *(Mobile: `onSelectKelurahan={setSelectedKelurahan}` directly.)*
3. `selectedKelurahan.kode_wilayah` changes → effect (b) fetches forecasts, showing the loading state.
4. `featureStyle` gives the polygon a teal border; the GeoJSON `key` changes → layer remounts; `SelectedFocus` calls `fitBounds` with 60 px padding, maxZoom 15.
5. `SelectedAreaPanel` (desktop) or `MobileBottomSheet` renders with `getRiskBadge(tingkat)`, `FloodDepthEstimate(estimasi_kedalaman_cm)`, `CitizenActionHub`, and the "what it means" text.
6. When the forecast arrives, the panel's Cuaca tab fills with up to 8 mini-cards.

### 7.3 Turn on a scenario

1. Sidebar → `simulasi` → "⚙️ Buka Pengendali Simulasi" → `<SimulationController isOpen>`.
2. Click a preset → `onToggleMode(true)` then `onChangeSimulation({...preset, activePreset: id})`.
3. `isSimulation` flips → every polygon's `getFeatureRisk` switches to the simulated branch → new `tingkatKey` → `summary` recomputes per the simulation branch → legend and header chips update → the GeoJSON `key` (which includes `JSON.stringify(simulationState)`) changes → full restyle.
4. `FloodMap` shows the top banner with rain/tide/scenario name.
5. Selecting a kelurahan now stores `estimasi_kedalaman_cm` from the simulated formula and `kondisi_bmkg = "Skenario: …"`, so the depth card and SVG figure reflect the scenario.
6. Any slider drag sets `activePreset: "custom"` and keeps simulation on.
7. "Kembali ke Data Real-Time Asli" (or "✕ Reset Real-Time") → `handleResetSimulation()` restores the literal normal state.

### 7.4 Generate an evacuation route

Desktop: sidebar → `posko` → a posko card → "🗺️ Buat Rute Evakuasi" (uses the selected kelurahan, else `daftarKelurahan[0]`). Mobile: the "Posko Evakuasi (12)" chip → modal → "🗺️ Rute".

`handleShowRoute` → origin = first ring vertex of the kelurahan polygon → destination = posko → `generateJalurEvacuasi` → `setActiveRoute` → `FloodMap` draws the dashed polyline + two pins + `EvacuationRouteCard` (distance, minutes by car/walk, advisories, Google Maps link, `tel:` to the posko). "Reset rute" in the bottom dock clears it (`onClearRoute`).

Route from a facility: open a facility popup → "🚶‍♂️ Rute Evakuasi ke Sini" → `handleStartRouteToFacility(facility)` (origin = selected kelurahan or city centre).

### 7.5 Canal buffer analysis

Sidebar/map → enable the buffer tool → choose a waterway (dropdown or by clicking the waterway line) → choose 100/250/500 m → `buildRiverBufferGeoJson` regenerates the corridor quads → amber `GeoJSON` overlay + teal centreline. `RiverBufferTool` lists the statically known affected kelurahan; clicking a name sets `search`, which filters the choropleth to that name.

### 7.6 Tide widget

Mounts inside the `pasut` drawer (or mobile modal) → `fetchMarineData()` → `GET /api/maritim/pasut` → either live-looking numbers or the hard-coded fallback → renders status colour, metrics, schedule, coastal list → polls every 5 min.

### 7.7 GPS and camera reset

Bottom-right dock → "Lokasi saya" → `navigator.geolocation.getCurrentPosition` → blue dot + fly to zoom 14. "Reset peta" → `setResetCount(c=>c+1)` → `MapResetFocus` flies back to `[-5.1477, 119.4327]` zoom 12. If a route is active, the same button clears the route instead.

### 7.8 Theme and layout switching

Header toggle chip → `theme` flips → effect sets `data-theme` on `<html>` and writes `localStorage.jenebosi_theme`. "Laptop"/"HP" chip → `viewMode` flips → the other render tree mounts (state is preserved because it all lives in `App`). Resizing the window re-evaluates mode with the 640/1024 px hysteresis and a 200 ms debounce.

---

## 8. Data contract matrix (backend ↔ frontend)

### 8.1 Endpoints the frontend actually calls

| Endpoint | Called from | Consumed fields |
|---|---|---|
| `GET /api/kelurahan/geojson` | `App.jsx:143` | `features[].geometry`, `features[].properties.{id, kode_wilayah, nama_kelurahan}` |
| `GET /api/banjir` | `App.jsx:144` | `kelurahan_id, nama_kelurahan, kode_wilayah, tingkat, hujan_mm, elevasi_m, indeks_kerawanan, estimasi_kedalaman_cm, kondisi_bmkg, waktu_analisis, metode, sumber_model` (only the first ten are read) |
| `GET /api/bmkg/prakiraan/{kode}` → fallback `GET /api/prakiraan/{kode}` | `App.jsx:194–195` | envelope `{prakiraan:[…]}`, items' `waktu_lokal, suhu_c, kelembapan_persen, kondisi` |
| `GET /api/maritim/pasut` | `TideMonitorWidget.jsx:26` | `status, sumber, stasiun, waktu_wita, ketinggian_pasut_m, tinggi_gelombang_m, kecepatan_arus_ms, periode_gelombang_detik, total_elevasi_m, status_rob, status_label, status_desc, jadwal_harian[]` |

### 8.2 Endpoints implemented but never called by this client

`GET /` (only relevant when the backend serves the dist), `GET /api/health`, `GET /api/cron/sync-weather` (cron only), `GET /api/sync-status`, `GET /api/kelurahan?q=`, `GET /api/kelurahan/{id}/hujan-terbaru`.

That is **6 of the 10 handlers unused by the UI**. `sync_prakiraan_bmkg.py` uses `/api/bmkg/prakiraan/{kode}`, and health/sync-status are monitoring affordances — worth keeping, but they signal features the frontend never adopted (server-side search; per-kelurahan rainfall display).

### 8.3 Field-name reconciliation

The three name-mapping seams in the system:

| Layer | Server name | Client name | Where mapped |
|---|---|---|---|
| Forecast time | `waktu_prakiraan` (aliased to `waktu_lokal` in SQL) | `waktu_lokal`, also accepts `datetime`, `waktu` | SQL alias + `normalisasiPrakiraan` |
| Forecast condition | `kondisi_cuaca` (aliased to `kondisi`) | `kondisi`, also accepts `weather_desc`, `cuaca` | SQL alias + `normalisasiPrakiraan` |
| Risk level | `tingkat` (`Rendah`/`Sedang`/`Tinggi`/`Sangat Tinggi`) | `tingkatKey` (`rendah`/`sedang`/`tinggi`/`sangat_tinggi`/`belum`) | `getFeatureRisk` + `getRiskBadge` + `summary` + `getTypicalFloodDepth` |

The risk-level normalisation is duplicated in **four** places (`FloodMap.getFeatureRisk`, `App.summary`, `SelectedAreaPanel.getRiskBadge`, `FloodDepthSimulator.getTypicalFloodDepth`) with slightly different keyword lists (`getTypicalFloodDepth` does not recognise "waspada"/"siaga" the same way the others do). A single shared `normaliseRisk()` helper would remove a whole class of future bugs.

---

## 9. Bugs, inconsistencies, dead code and risks

Ordered roughly by impact. Line numbers refer to the current commit.

### 9.1 Functional bugs

1. **The BMKG integration is circular and non-functional.** `sync_prakiraan_bmkg.py` reads `GET http://127.0.0.1:8000/api/bmkg/prakiraan/{kode}`, which reads the very table it writes. Nothing in the repository ever calls `api.bmkg.go.id`, even though `bmkg_test.json` holds a real payload and `normalisasiPrakiraan` can already parse that shape. Effect: the "BMKG forecast" shown to citizens is whatever happens to be in `prakiraan_bmkg` (possibly nothing, or a manual insert).
2. **`ON CONFLICT (kode_wilayah, waktu_prakiraan)` has no matching unique constraint.** `init_bmkg_table.py` creates only a non-unique index on `(kelurahan_id, waktu_prakiraan)`. Postgres will reject the statement with *"no unique or exclusion constraint matching the ON CONFLICT specification"*.
3. **`diambil_pada = NOW()` in that same upsert references a column that the DDL never creates** (`created_at` exists instead) → `UndefinedColumn`.
4. **`CAST(:waktu AS timestamp)` strips the timezone** from a `TIMESTAMPTZ` value, so forecasts land 8 hours off if the DB session timezone is not Asia/Makassar.
5. **`GET /api/kelurahan/{id}/hujan-terbaru` converts its own 404 into a 500** (`raise HTTPException(404, …)` inside a `try` whose `except Exception` re-wraps it).
6. **Fallback forecast ordering is reversed** (`ORDER BY waktu_prakiraan DESC`) relative to the primary path, so the UI time series runs backwards whenever the fallback triggers.
7. **`/api/maritim/pasut` never surfaces failure**: every exception becomes a 200 with hard-coded numbers, and `TideMonitorWidget` only prints a small amber note. A user can be shown a calm "Surut Normal / 0.55 m" during a network outage and cannot tell.
8. **The tide component is synthetic, not measured.** `0.9 + 0.65·cos(2πt/12.42)` with a 0.1×wave surge term is a hand-tuned approximation. It is documented in a comment and labelled "Model Harmonik M2" in `sumber`, but the widget's headline says "API Live Real-Time".
9. **`/api/cron/sync-weather` is unauthenticated** and blocks the event loop (`async def` calling blocking `httpx` + DB I/O). Also returns 200 on error, hiding failures from the cron runner.
10. **The sync silently no-ops** when `parameter_kerawanan_kelurahan` is empty (INNER JOIN) and reports the misleading message *"Tidak ada kelurahan dengan koordinat latitude/longitude yang valid."*
11. **`GET /` serves the SPA without mounting `/assets`**, so the single-container Docker deployment returns an HTML page whose scripts 404.
12. **Root `vercel.json` points at a non-existent `api/main.py`** — deploying from the repo root with that config fails.
13. **`hujanTerbaru={0}` is hard-coded** in both `RainfallInsight` usages, so "STATUS HUJAN HARI INI" always reads "0 mm (Kering)" even during heavy rain.
14. **Summary vs. map disagree in simulation mode.** `App.summary` uses `const e = 5` (stub elevation), so its `isCoastal` check is name-only, while `FloodMap.getFeatureRisk` uses real elevation — but `elevasiData` is never passed, so *it* is `null` too. Net effect: legend counts and polygon colours can differ.
15. **`simulationState.bufferM` and `riverOverflow` are never used**; the buffer radius comes from separate App state, so dragging the simulation's "radius sempadan" slider does nothing.
16. **Compare mode is unreachable**: `setCompareMode(true)` is never called anywhere in `FloodMap`, so the entire split-screen feature (controller, divider, badges, CSS) is dead. Same for the layer toggles: `setShowPosko`/`setShowKanal` are never called, so the waterways layer can never be displayed.
17. **`WaterHeightSimulatorModal` can never open** (`setWaterSimulatorOpen(true)` is never called).
18. **`IntroSection`** and **`App.css`** are dead files.
19. **Stale UI copy:** `CitizenSafetyGuide` promises "30 lokasi posko resmi" but the dataset has 12.
20. **`SelectedAreaPanel` does not receive simulation props**, yet `App` passes `isSimulation` / `simulationState` to it (its signature declares neither — harmless, but the intent was clearly to show a simulation badge there).
21. **Polygon click bypasses `handleSelectKelurahan`**: on desktop the map calls `setSelectedKelurahan(kel)` directly, so `kecamatan` is `""` (never populated by any endpoint) and the `estimasi_kedalaman_cm` comes from `getFeatureRisk` rather than the App-level formula. Two code paths, two slightly different objects for the same kelurahan.

### 9.2 Security and repository hygiene

| Issue | Detail |
|---|---|
| **Committed DB credentials** | `backend/.env` is tracked and contains a live Supabase host, project ref, username and password. Anyone with repo read access has full DB access. Rotate the password and move to environment variables. |
| **Committed virtualenv** | `backend/.venv` — **9 179 of the 9 254 tracked files**, including Windows `Lib/` and `.exe`-producing `Scripts/`, plus thousands of `__pycache__/*.pyc`. Bloats the repo, breaks diffs, leaks the maintainer's OS and Python setup. |
| **No root `.gitignore`** | only `frontend/.gitignore` exists, which is why the above happened. |
| **CORS regex `https://.*\.vercel\.app`** | allow-lists every Vercel preview deployment on the internet. Combined with `allow_credentials=True`. |
| **Error messages echoed to clients** | every handler returns `detail=str(exc)`; DB errors can disclose hostnames, table names and query fragments. |
| **Unauthenticated write endpoint** | `/api/cron/sync-weather`. |
| **No rate limiting / caching** | `/api/kelurahan/geojson` (~1 MB) is re-serialised from PostGIS on every request with no `Cache-Control`/ETag. |

### 9.3 Performance

- **GeoJSON payload size**: full-detail MultiPolygons, no `ST_Simplify`, no `ST_AsGeoJSON(geom, precision)`, no compression hint. On a 3G phone this is the slowest part of first paint.
- **GeoJSON layer remount on every keystroke** (`key` includes `search`) — 153 layers destroyed and rebuilt per character typed.
- **`JSON.stringify(simulationState)` in that same `key`** — recomputed on every render, and any slider tick remounts the layer tree.
- **N+1 writes** in `rain_sync` (1 SELECT + 1 INSERT/UPDATE per kelurahan in a single transaction).
- **Modal components render even when closed**: `SimulationController` and `WaterHeightSimulatorModal` return `null` early (good), but `TideMonitorWidget` starts polling as soon as the `pasut` drawer mounts and keeps polling for the component's lifetime — acceptable, but note it fetches external data every 5 min even if the user never looks.
- **`index.css` is 7 075 lines of unminified hand-written CSS** (Vite minifies at build, but the cascade is heavy and contains duplicated blocks).

### 9.4 Code-quality observations (not bugs)

- `App.jsx` at 1 225 lines mixes data fetching, business rules, three modal systems and two complete layouts. Extracting hooks (`useKelurahanData`, `useForecast`, `useSimulation`) and the two layout trees into separate components would be the single highest-value refactor.
- Risk-level normalisation is duplicated in four places (see §8.3).
- The simulation "normal" scenario literal exists twice (`App.simulationState` initial value and `PRESET_SKENARIO.normal`), and `handleResetSimulation` duplicates it a third time.
- The offline tide fallback object exists twice (backend `main.py` and `TideMonitorWidget.jsx`).
- `SIDEBAR_ITEMS` is exported from `DockedSidebar` but the drawer titles are a separate ternary chain in `App` — two lists to keep in sync.
- Many imports are unused (`IconShield`, `IconCompass`, `IconInfo` in `App.jsx`; five icons in `FloodMap.jsx`). `oxlint` would catch most of them, but the ruleset enables only two rules.
- No tests anywhere — frontend or backend. No linter run in CI. No TypeScript/JSDoc typing on props.
- `apscheduler` and `GeoAlchemy2` are declared dependencies that are never imported.

---

## 10. How to run it locally, and how to extend it

### 10.1 Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate      # or .\.venv\Scripts\activate on Windows
pip install -r requirements.txt
# create/point backend/.env at a PostGIS database:
#   DATABASE_URL=postgresql+psycopg://user:pass@host:5432/dbname
python init_bmkg_table.py                              # creates prakiraan_bmkg
psql "$DATABASE_URL" -f sql/001_flood_risk_parameters.sql
uvicorn app.main:app --reload --port 8000              # must be run from backend/
```

Then, **in dependency order**, to have real data:

```
download_batas.py            → data/batas_kelurahan/kelurahan.geojson   (fix the hard-coded E:\ path)
import_kelurahan.py          → public.kelurahan (153 polygons)
hitung_elevasi_api.py        → public.elevasi_kelurahan
(sql insert)                 → public.parameter_kerawanan_kelurahan (1–5 scores + sources; NOT in the repo)
GET /api/cron/sync-weather   → public.curah_hujan + public.potensi_banjir
```

`GET /api/health` should then report `jumlah_kelurahan: 153`.

### 10.2 Frontend

```bash
cd frontend
npm install
npm run dev        # Vite on 5173 → talks to http://127.0.0.1:8000
npm run build      # → dist/
npm run lint       # oxlint
```

If the API lives elsewhere, set `VITE_API_BASE_URL` (e.g. `VITE_API_BASE_URL=https://my-backend.vercel.app npm run dev`).

**Note for sandbox/preview environments:** the dev build defaults to `http://127.0.0.1:8000`, which is resolved *by the browser*, not by the dev server — so in any hosted preview the API calls will fail unless (a) `VITE_API_BASE_URL` points at a publicly reachable backend, or (b) a Vite dev proxy for `/api` is added and the base becomes same-origin. Additionally the backend's CORS list only includes `localhost:5173`, so a preview host origin must be added to `CORS_ORIGINS`.

### 10.3 Where to extend

| Goal | Touch |
|---|---|
| Real BMKG forecast | new `services/bmkg_client.py` that calls `api.bmkg.go.id` and flattens `data[].cuaca[][]` into the `prakiraan_bmkg` schema (the shape is already in `bmkg_test.json`); then make `sync_prakiraan_bmkg.py` call *that*, not our own endpoint; add `UNIQUE(kode_wilayah, waktu_prakiraan)` + `diambil_pada` in `init_bmkg_table.py`, and store `TIMESTAMPTZ` without the `CAST(... AS timestamp)`. |
| Real rainfall in mm in the risk score | replace `rain_score_from_bmkg` with a mm-banded scorer (0.5–20/20–50/50–100/>100 mm, exactly the bands already printed in `RainfallInsight`), and pass `hujan_val` into `calculate_risk`. |
| Real routing | swap `generateJalurEvakuasi` for OSRM/Valhalla or PostGIS `pgr_dijkstra` on an OSM road network; keep the same return shape (`waypoints, jarakKm, waktuKendaraanMenit, waktuJalanKakiMenit, advisories, googleMapsUrl`). |
| Real buffers | replace `buildRiverBufferGeoJson` with `ST_Buffer(geom::geography, r)` server-side, or `@turf/buffer` client-side. |
| Lighter map payload | `ST_SimplifyPreserveTopology(geom, 0.0001)` + `ST_AsGeoJSON(geom, 6)`; add `Cache-Control: public, max-age=3600` and an ETag. |
| Per-kelurahan rainfall panel | the endpoint `/api/kelurahan/{id}/hujan-terbaru` already exists — feed `RainfallInsight`'s `hujanTerbaru` prop instead of the hard-coded `0`. |
| Sensors / AWLR | `getTypicalFloodDepth` already prefers `kelurahan.kedalaman_air_cm` — add that field to `/api/banjir` and everything downstream works. |
| Fix compare mode | add a toolbar button that calls `setCompareMode(v => !v)`; `MapCompareController` needs nothing else. |

---

## 11. Glossary

| Term | Meaning |
|---|---|
| **kelurahan** | the lowest Indonesian administrative unit (village/ward); Makassar has 153 |
| **kecamatan** | district (above kelurahan) |
| **banjir** | flood |
| **potensi banjir** | flood potential / risk |
| **kerawanan** | susceptibility / vulnerability |
| **tingkat** | level (of risk) |
| **curah hujan** | rainfall |
| **prakiraan** | forecast |
| **pasang surut / pasut** | tide |
| **rob** | coastal/tidal flooding (backwater from high tide) |
| **gelombang** | wave |
| **arus** | current |
| **elevasi / m dpl** | elevation / metres above mean sea level (*di atas permukaan laut*) |
| **sempadan** | riverbank setback / buffer zone |
| **kanal / saluran** | canal / drain |
| **posko** | emergency shelter / command post |
| **pengungsian** | evacuation/refuge |
| **jalur evakuasi** | evacuation route |
| **kedalaman** | depth |
| **genangan** | standing water / inundation |
| **siaga** | alert/standby (2nd-highest level here) |
| **waspada** | caution (2nd-lowest) |
| **bahaya ekstrem** | extreme danger |
| **BMKG** | meteorology, climatology and geophysics agency (weather service) |
| **BPBD** | regional disaster-management agency |
| **BNPB** | national disaster-management agency |
| **Basarnas** | national search-and-rescue agency |
| **BIG / BAPANAS** | geospatial information agency; the source of the boundary layer |
| **DEM** | digital elevation model (here Copernicus GLO-90, 90 m) |
| **AWLR** | automatic water-level recorder (a real sensor; the app explicitly is *not* this) |
| **WITA** | UTC+8, Central Indonesia Time (Makassar) |
| **Open-Meteo** | free weather/forecast/elevation/marine API used by the backend |
| **M2 constituent** | the principal semi-diurnal lunar tidal component, period ≈ 12.42 h |
| **Haversine** | great-circle distance formula |
| **detour factor** | ratio of road distance to straight-line distance (here 1.3) |
| **HOTSPOT-style overlay** | weighted multi-criteria spatial scoring (the Nurliah et al. 2025 method) |

---

*Document generated from a complete read of the repository at `a81fd4d`. Everything described is present in the code as committed; the "how to extend" section is the only forward-looking part.*
