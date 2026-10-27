# JeneBosi (WebGIS2MBC) — Technical Defence Brief

**Purpose:** everything you need to defend this project technically in front of a lecturer — the formal definitions, the mathematics, the measured numbers, the design trade-offs, and the honest weak points with prepared answers.
**Companion document:** `docs/CODE_WALKTHROUGH.md` (file-by-file, line-by-line explanation).
**Every number in this document was measured or derived from the committed source at `a81fd4d`.** Where something is *not* implemented, it says so explicitly — that is deliberate, because the fastest way to lose a viva is to claim a feature you cannot demo.

---

## 0. How to use this document

| Section | Use it for |
|---|---|
| §1 | The 60-second system pitch + architecture slide |
| §2 | "Walk me through your pipeline" question |
| §3 | The technical core — formulas, derivations, sensitivity. **Highest marks live here.** |
| §4–§5 | Database & API questions |
| §6 | Frontend/engineering questions |
| §7 | Performance questions ("how does it scale?") |
| §8 | If they find a bug before you do — go on the offensive |
| §9 | Honesty/limitations — say these *before* they ask |
| §10 | 32 prepared Q&A (read twice, once the night before) |
| §11 | Live demo sequence with narration |
| §12 | 12-slide deck outline |
| §13 | One-page numbers cheat-sheet (print this) |
| §14 | Prioritised backlog for the roadmap slide |

### Your three-sentence thesis (memorise)

> JeneBosi is a **WebGIS decision-support and public-communication layer** for flood preparedness in Kota Makassar. It fuses **153 kelurahan administrative polygons (PostGIS)**, **a weighted multi-criteria susceptibility model adapted from Nurliah et al. (2025)**, **BMKG forecast conditions**, and **real-time rainfall/marine data from Open-Meteo**, and renders them as an interactive risk choropleth with evacuation routing and a scenario simulator. It is explicitly **not** a hydrodynamic flood model and **not** a sensor-based early-warning system — its contribution is integration, legibility for non-experts, and reproducible open tooling.

### Claims you MAY make vs claims you MUST NOT make

| ✅ Safe to claim | ❌ Do not claim |
|---|---|
| "Weighted multi-criteria **susceptibility** overlay" | "Flood **prediction** model" |
| "Indicative **inundation depth surrogate** for communication" | "Modelled / simulated inundation depth" |
| "BMKG **forecast condition** input" | "BMKG **observation** data" |
| "Real-time **meteorological** data via Open-Meteo" | "Real-time **water level / AWLR** monitoring" |
| "Indicative **schematic** evacuation route" | "Road-network routing / shortest safe path" |
| "Indicative **setback corridor** (buffer)" | "Legal floodplain / sempadan boundary" |
| "Prototype with **12 curated** shelters and facilities" | "Official BPBD shelter registry integration" |

---

## 1. System architecture

### 1.1 Layered view

```
┌─ PRESENTATION ───────────────────────────────────────────────────────────────┐
│ React 19 SPA · react-leaflet 5 / Leaflet 1.9 · hand-written CSS design system│
│   App.jsx (shell + all cross-cutting state)                                  │
│   FloodMap.jsx (map engine)  ·  22 presentational components                 │
│   static domain data: 12 shelters, 12 critical facilities, 6 waterways       │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │ HTTPS/JSON (fetch, 4 endpoints)
┌─ APPLICATION ────────────────▼───────────────────────────────────────────────┐
│ FastAPI 0.143 on Python 3.12 (uvicorn 0.54)                                  │
│   10 handlers · no ORM models · no Pydantic response schemas · raw SQL       │
│   services: flood_risk_model.py (pure functions) · rain_sync.py (ETL)        │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │ SQLAlchemy Core (psycopg 3, pool_pre_ping)
┌─ DATA ───────────────────────▼───────────────────────────────────────────────┐
│ PostgreSQL + PostGIS (Supabase) — 7 tables                                   │
│   geometry: MultiPolygon EPSG:4326 · ST_AsGeoJSON · ST_PointOnSurface        │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │ httpx (server-side: no CORS, no key exposure)
┌─ EXTERNAL ───────────────────▼───────────────────────────────────────────────┐
│ Open-Meteo:  /v1/forecast · /v1/elevation · /v1/marine                       │
│ BIG (BAPANAS) ArcGIS REST: kelurahan boundaries (offline ETL)                │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Why each choice (the "why", not the "what" — this is what gets asked)

| Decision | Justification | Cost you accept |
|---|---|---|
| **PostGIS instead of GeoJSON files** | Server-side geometry ops (`ST_AsGeoJSON`, `ST_Transform`, `ST_Multi`, `ST_CollectionExtract`, `ST_IsValid`, `ST_PointOnSurface`), single source of truth, geometries stay authoritative even if the client is rewritten | Requires a hosted PG+PostGIS (Supabase free tier) — a live DB dependency for every request |
| **Raw SQL (`text()`) instead of an ORM** | The queries are collection-shaped (GeoJSON assembly, lateral join for "next forecast"), not entity-shaped; zero N+1 in the read path; the exact SQL is reviewable | No compile-time safety, manual row→dict mapping, SQL spread across files |
| **FastAPI** | Async external calls (`httpx.AsyncClient`), automatic OpenAPI docs at `/docs`, Pydantic validation of query params for free, trivial Vercel/uvicorn deploy | No typed response models → the OpenAPI schema is uninformative |
| **Server-side proxy to Open-Meteo** | Keeps third-party calls off the browser (CORS, rate-limit attribution, one origin); lets the server *transform* the payload into the widget's exact contract | One more hop; the backend becomes a SPOF for the tide widget (hence the fallback) |
| **Two hand-rolled layouts (laptop / mobile)** rather than responsive CSS alone | The mobile UX is *not* a shrunk desktop map: it needs a bottom sheet with three snap states, a horizontal chip rail, and modals. Forcing that through media queries produced unmaintainable CSS | Duplicate JSX trees in `App.jsx` (~700 lines each); two places to fix a bug |
| **No UI framework / no state library** | Zero heavyweight deps (only 4 runtime deps in total); the state graph is small enough for `useState` in one component | `App.jsx` is 1 225 lines; prop-drilling; 26 `useState` calls |
| **Scenario simulator client-side** | Sub-50 ms feedback while dragging sliders — impossible if each change round-tripped to the DB. Maps a "what-if" onto existing per-kelurahan attributes | Simulated numbers are not persisted or server-auditable |

### 1.3 Deployment topology (two supported shapes)

```
A) SPLIT (current production)                    B) SINGLE CONTAINER (Dockerfile)
   Vercel static (frontend/)                       node:20-alpine  → vite build → dist
     /api/* ──rewrite──► webgis2mbc-backend…        python:3.12-slim → uvicorn :8000
     /*     ──rewrite──► /index.html                serves  /  = frontend/dist/index.html
   FastAPI on Vercel Functions + daily cron
```
Split topology is the one that works end-to-end; the Docker path has a static-asset gap (see §8.2 #7).

---

## 2. The data pipeline — six stages

Read this as a DAG; stage *n* cannot run before *n-1*.

```
 BIG ArcGIS ──►[S1 boundaries]──► kelurahan_import ──[S2 load]──► kelurahan (153)
                                                                     │
                                            [S3 elevation] ◄─────────┤
                                       elevasi_kelurahan              │
                                                                      │
                    manual GIS overlay / field survey                │
                    parameter_kerawanan_kelurahan ◄───────────────────┤ (4 × scores 1-5)
                                                                      │
 Open-Meteo /v1/forecast ──[S5 daily sync]──► curah_hujan              │
 Open-Meteo /v1/elevation ───────────────────► potensi_banjir ◄────────┘
 (BMKG ingestion — scaffolded but NOT wired, see §8.1)
```

### S1 — Boundary acquisition (`download_batas.py`)
ArcGIS REST query against BIG `BAPANAS/Batas_Administrasi/MapServer/2`:

```
where   = WADMKK LIKE '%Makassar%'
outSR   = 4326        (reproject server-side: no client-side CRS guessing)
f       = geojson
timeout = 90 s
```
**Verified output:** 153 features, **15 kecamatan**, 153 unique `WADMKD` names, 153 unique `KDEPUM` codes, all `EPSG:4326`, geometry `Polygon`×149 + `MultiPolygon`×4.
**Assumption:** the BIG layer is authoritative for administrative extents. **Failure mode:** if the service changes schema, the script's explicit `WADMKD` presence check fails loudly instead of importing junk.

### S2 — Load into PostGIS (`import_kelurahan.py`) — the hygiene checklist
This script is your strongest answer to *"how do you ensure geospatial data quality?"*:

1. abort if the file is empty or **`crs is None`** (code comment: *"Jangan menebak CRS sumber"* — never guess the source CRS);
2. require `WADMKD`; filter `WADMKK ~ Makassar`;
3. build `kode_wilayah` from `KDEPUM`, **falling back per cell to `KDEBPS`** (`fillna`), so a missing PUM code does not silently drop the row;
4. drop NULL/empty name, code and geometry;
5. reproject → `EPSG:4326`; **`make_valid()`** every invalid geometry; keep `Polygon|MultiPolygon` only; dedupe on `kode_wilayah`;
6. write to a **staging table** (`kelurahan_import`) via GeoPandas `to_postgis`, verify `COUNT(*) > 0`, then swap into production in a **single transactional `INSERT … SELECT`**;
7. normalise in SQL:
```sql
ST_Multi( ST_CollectionExtract( ST_MakeValid( ST_Force2D(geometry) ), 3 ) )::geometry(MultiPolygon,4326)
```
`ST_CollectionExtract(…,3)` keeps polygon components only (3 = POLYGON), `ST_Force2D` drops the constant Z, `ST_Multi` guarantees a single geometry type for the table;
8. `ON CONFLICT (kode_wilayah) DO UPDATE` → **idempotent re-import**.

**Verified geometry statistics of the source file (useful numbers for the slide):**

| metric | value |
|---|---|
| features / polygons / rings | 153 / 163 / 163 |
| total vertices | **27 130** (avg 177 per kelurahan) |
| most detailed / least detailed | Barombong 684 / Butung 17 vertices |
| coordinate dimensionality in source | **3D** (constant `Z = 0`) → dropped by `ST_Force2D` |
| source coordinate precision | e.g. `119.48486163799998` = IEEE-754 artefact of `119.48486164` (≈0.1 mm "precision" on a ~1:50 000 boundary) |
| unique names / unique codes | 153 / 153 → keying by name in the client is currently collision-free |

### S3 — Elevation (`hitung_elevasi_api.py`, chosen over `hitung_elevasi.py`)
Representative point per kelurahan computed **in SQL**:

```sql
ST_Y(ST_PointOnSurface(ST_Transform(geom,4326))) AS latitude,
ST_X(ST_PointOnSurface(ST_Transform(geom,4326))) AS longitude
```

`ST_PointOnSurface` is used **instead of a centroid on purpose**: the centroid of a concave or multi-part kelurahan can fall *outside* the polygon (into the sea or into a neighbour) and would then sample the wrong elevation.

Then batched 100 points per call to `api.open-meteo.com/v1/elevation` (Copernicus GLO-90, 90 m posting), with `time.sleep(0.3)` between batches (rate-limit hygiene), a hard check `len(elevations) == len(batch)` (guards silent misalignment — the most likely bug class in batch APIs), and an upsert on `kelurahan_id`.

**Honest limitation to state first:** the stored elevation is **one point sample per kelurahan**, not an areal statistic. `hitung_elevasi.py` implements proper **zonal statistics** (`min/mean/max/count` from a local DEM GeoTIFF via `rasterstats`) and writes `elevasi_rata_m` — but **its CSV output is never loaded into the database**, and it needs `rasterio`/`rasterstats`, which are not in `requirements.txt`. So intra-kelurahan elevation variation (exactly what drives street-level flooding in Makassar's 0–20 m coastal belt) is **not modelled**.

### S4 — Static susceptibility scores (`sql/001_flood_risk_parameters.sql`)
`parameter_kerawanan_kelurahan`: one row per kelurahan with **four `SMALLINT` scores, each `CHECK 1..5 NOT NULL`**, plus a **mandatory provenance column per score** (`sumber_penggunaan_lahan`, `sumber_jenis_tanah`, `sumber_jarak_sungai`, `sumber_kemiringan_lereng`). The migration header instructs operators to derive scores from real overlay layers (*"Jangan mengisi dengan asumsi"* — do not fill with assumptions).

> **No seed script for this table exists in the repository.** Because `rain_sync` INNER JOINs it, an empty table makes the nightly job process **0 kelurahan** and report success. If asked *"where do the 1–5 scores come from?"* the correct answer is: *"the table enforces 1–5 plus a source string per criterion so every score is auditable; population is a GIS step outside the code, and any value without a provenance row must be treated as expert judgement."*

### S5 — Daily operational sync (`rain_sync.py`, Vercel cron `0 0 * * *` = 08:00 WITA)
```
read 153 kelurahan (needs elevation + parameters + next BMKG condition)
  → HTTP GET Open-Meteo /v1/forecast, 50 coordinates per request  (⌈153/50⌉ = 4 requests)
  → one transaction: INSERT curah_hujan  +  UPSERT potensi_banjir
```
Details that show engineering care — and the ones that will be attacked:

| 👍 | 👎 |
|---|---|
| multi-coordinate batching (4 calls instead of 153) | **N+1 writes**: 1 `SELECT` + 1 `INSERT`/`UPDATE` per kelurahan |
| handles the API's 1-point→object / n-point→array asymmetry | one transaction → **a single bad row rolls back all 153** |
| `daily.precipitation_sum[0]` with `current.precipitation` fallback | that "daily sum" at 08:00 WITA is mostly a **forecast** for the rest of the day, not an observation |
| per-batch failure isolation (`continue`) + counters in `last_sync_info` | `gagal = total − berhasil` conflates HTTP failure with "no data" |
| `LEFT JOIN LATERAL … LIMIT 1` for the next forecast condition per kelurahan | depends on `prakiraan_bmkg`, which nothing populates (§8.1) |

### S6 — Forecast table (`init_bmkg_table.py`, `sync_prakiraan_bmkg.py`)
Intended: BMKG forecast → `prakiraan_bmkg` → `/api/bmkg/prakiraan/{kode}` → UI.
Actual: the sync script calls **our own API** instead of BMKG (**circular**), and its `ON CONFLICT (kode_wilayah, waktu_prakiraan)` has **no matching unique constraint** in the DDL it ships with. See §8.1 — address this proactively.

---

## 3. Algorithms and mathematics — the core

> Frame it as: *"The model has three numerical components — a **susceptibility index**, a **depth surrogate**, and a **scenario perturbation** — plus three geometric algorithms (buffer, distance, and the impact classifier). Each is separately defensible and separately limited."*

### 3.1 Weighted multi-criteria susceptibility index

**Formal definition.** Let a kelurahan $k$ be described by five integer scores $s_i(k)\in\{1,\dots,5\}$ with weights $w_i$:

$$
I(k)=\sum_{i=1}^{5} w_i\, s_i(k), \qquad (w) = (35,\;25,\;20,\;10,\;10)
$$

$$
I(k)\in[100,\;500]:\quad I=100 \iff \text{all } s_i=1,\qquad I=500 \iff \text{all } s_i=5
$$

| $i$ | criterion | $w_i$ | share of the 400-point range | score source |
|---|---|---|---|---|
| 1 | land use (*penggunaan lahan*) | 35 | 35 % | static table |
| 2 | rainfall (*curah hujan*) | 25 | 25 % | **BMKG forecast condition → categorical score** |
| 3 | river distance (*jarak sungai*) | 20 | 20 % | static table |
| 4 | soil type (*jenis tanah*) | 10 | 10 % | static table |
| 5 | slope (*kemiringan lereng*) | 10 | 10 % | static table |

**Classification** (piecewise constant on $I$):

| $I$ | class | Indonesian label | UI colour |
|---|---|---|---|
| ≤ 230 | Low | Rendah / "Aman" | `#10B981` |
| 231–330 | Moderate | Sedang / "Waspada" | `#F59E0B` |
| 331–430 | High | Tinggi / "Siaga" | `#F97316` |
| > 430 | Very high | Sangat Tinggi / "Bahaya" | `#EF4444` |

**The rainfall term is categorical, on purpose.** `rain_score_from_bmkg()` maps the *forecast condition string*:

| substring in condition | score |
|---|---|
| `ekstrem`, `petir`, `lebat` | 5 |
| `hujan` (any other) | 4 |
| `berawan`, `kabut` | 2 |
| none / NULL | 1 |

This is the most important methodological defence in the project: *the 25 % "rainfall" criterion is driven by a categorical forecast, not by millimetres*, because conflating a BMKG weather descriptor with a measured rainfall depth would be a category error. The code comment says exactly this (*"bukan mm observasi"*). Consequence to state openly: **the mm value the same job just downloaded is stored but not used in the index** — "rain now" and "rain susceptibility" are deliberately separate signals.

**Sensitivity analysis (the slide that earns marks).** Because the index is linear, the marginal effect of one score step is exactly the weight:

| criterion | Δscore = +1 → ΔI | Δdepth evaluated at I ≈ 300 |
|---|---|---|
| land use | **+35** | 60 → **70 cm** |
| rainfall | +25 | 60 → **70 cm** |
| river distance | +20 | 60 → 65 cm |
| soil | +10 | 60 → 65 cm |
| slope | +10 | 60 → 65 cm |

So **one step in land use is worth 3.5 steps in slope.** State it openly: the model is *deliberately* land-use dominated (consistent with the urban-flood literature it adapts), and any rank-order claim is sensitive to that choice.

**Enumerating the model space.** There are $5^5=3125$ score combinations but only **77 distinct index values** (integer weights → a lattice with step 5). Under a *uniform* prior over combinations (a null model, not a real distribution):

| class | combinations | share |
|---|---|---|
| Rendah | 559 | 17.9 % |
| Sedang | 1 532 | **49.0 %** |
| Tinggi | 951 | 30.4 % |
| Sangat Tinggi | 83 | **2.7 %** |
| mean / median / σ | 300 / 300 / 70 | |

Two defensible observations: (i) the middle class is over-represented under a neutral prior — desirable, because it is the *actionable* band for preparedness; (ii) "Sangat Tinggi" is hard to reach (2.7 %), which is appropriate for an alarm class, but it also means **the red band is rare by construction of the scoring lattice, not by Makassar's geography.** If your map shows few red kelurahan, that is the lattice, not the city.

**Worked examples (use these live).**

| # | land use | rain | river | soil | slope | $I$ | class | depth |
|---|---|---|---|---|---|---|---|---|
| A | 4 | 5 (lebat) | 4 | 3 | 2 | **395** | Tinggi | 90 cm |
| B | 5 | 1 (cerah) | 3 | 2 | 1 | **290** | Sedang | 55 cm |
| C | 3 | 4 (hujan) | 3 | 3 | 3 | **325** | Sedang | 70 cm |
| D | 2 | 2 (berawan) | 2 | 2 | 5 | **230** | Rendah (boundary) | 40 cm |

Example D is worth pointing out: steep slope alone never rescues a kelurahan from moderate risk — a direct consequence of the 10 % weight.

### 3.2 Depth surrogate (index → centimetres)

$$
D(k)=\max\!\Big(0,\ \min\!\big(120,\ 5\cdot\operatorname{round}\big(\tfrac{I(k)-100}{400}\cdot\tfrac{120}{5}\big)\big)\Big)\ \text{cm}
$$

A linear rescale of $I$ onto 0–120 cm, quantised to 5 cm.

- $I=100\Rightarrow0$ cm · $I=230\Rightarrow40$ · $I=330\Rightarrow70$ · $I=430\Rightarrow100$ · $I=500\Rightarrow120$.
- The **77 distinct indices collapse into 25 depth buckets**; e.g. 60 cm is produced by $I\in\{295,300,305\}$.
- The 5 cm quantisation exists so the UI never shows false precision — "37.4 cm" would imply a measurement that does not exist.

**Say this verbatim:** *"The depth is a **monotone surrogate** for communication — it maps a dimensionless susceptibility index onto a familiar unit. It is not the output of a hydrodynamic solver, a DEM-based flood-fill, or a sensor."* (The code comment states the same.)

### 3.3 Tidal harmonic model (`/api/maritim/pasut`)

A **single-constituent M2** approximation at the Paotere tide station (−5.12° S, 119.40° E):

$$
h(t)=0.9+0.65\cos\!\Big(\frac{2\pi t}{12.42}\Big)\ \text{m},
\qquad H_{\text{total}}=h(t)+0.1\,H_{\text{wave}}
$$

- $12.42$ h = M2 (principal lunar semi-diurnal) period; $0.9$ m = assumed offset to mean sea level; $0.65$ m = assumed M2 amplitude.
- $t$ = hour-of-day + minute/60 in **WITA = UTC+8**.
- The $0.1\,H_{\text{wave}}$ term is a crude wave-setup proxy, not a physical formulation.

Derived behaviour (24 hourly samples of the formula):

| statistic | value |
|---|---|
| max / min | **1.55 m** at 00:00 / **0.25 m** at 06:00 and 19:00 |
| hours ≥ 1.10 m (`waspada`) | 9 h/day (00–02, 10–14, 23) |
| hours ≥ 1.40 m (`ekstrem`) | 4 h/day (00, 01, 12, 13) |
| schedule shown in the UI (hours 1, 7, 13, 19) | 1.469 / 0.301 / 1.522 / 0.261 m |

**Three criticisms to pre-empt, with answers:**
1. *"One M2 constituent cannot reproduce Makassar's mixed tide."* → Correct. Real prediction needs S2, K1, O1 and local harmonic constants (or a tide-gauge series). This is a **visualisation stand-in** that keeps the widget alive when the marine API is down; it is labelled as a model in `sumber` and in the code ("indicative only").
2. *"Your 1.10 m 'waspada' threshold is arbitrary."* → Yes: 1.40/1.10 are operational-looking round numbers chosen so the widget has three states; they are **not** derived from a return-period analysis or a published datum (HAT, or a BMKG rob warning level). Offering to calibrate against BMKG rob advisories is the right follow-up.
3. *"Why fixed labels at 01:00 / 07:00 / 13:00 / 19:00?"* → Those four hours are hard-coded *labels*; only the **heights** come from the cosine. On some days the hour labelled "Surut Pagi" is in fact a rising tide. The fix is to compute the extrema of $h(t)$ analytically ($\cos$ extrema at $t = 12.42k/2$).

### 3.4 Canal setback corridor — deriving a buffer without a geometry library

`buildRiverBufferGeoJson(line, r)` builds the corridor **in degrees** using a local equirectangular approximation. For each segment $(\lambda_1,\varphi_1)\to(\lambda_2,\varphi_2)$:

$$
m_\varphi = 110\,540\ \tfrac{\text{m}}{^\circ},
\qquad
m_\lambda(\bar\varphi)=111\,320\cos\bar\varphi\ \tfrac{\text{m}}{^\circ},
\qquad
\bar\varphi=\tfrac{\varphi_1+\varphi_2}{2}
$$

$$
d_x=(\lambda_2-\lambda_1)m_\lambda,\quad
d_y=(\varphi_2-\varphi_1)m_\varphi,\quad
L=\sqrt{d_x^2+d_y^2}
$$

$$
\Delta\lambda=\frac{-d_y}{L}\cdot\frac{r}{m_\lambda},
\qquad
\Delta\varphi=\frac{d_x}{L}\cdot\frac{r}{m_\varphi}
$$

The emitted polygon is the quadrilateral
$(\lambda_1+\Delta\lambda,\ \varphi_1+\Delta\varphi),\ (\lambda_2+\Delta\lambda,\ \varphi_2+\Delta\varphi),\ (\lambda_2-\Delta\lambda,\ \varphi_2-\Delta\varphi),\ (\lambda_1-\Delta\lambda,\ \varphi_1-\Delta\varphi)$, closed.

At Makassar's latitude $\bar\varphi\approx-5.15°$: $m_\lambda=110\,871$ m/°, $m_\varphi=110\,540$ m/° → **0.23 % anisotropy**, which this formula absorbs by computing both factors per segment. Scale check: $r=250$ m → $0.002255°$ longitude ≈ 250 m. ✔

**Error and topology analysis (say this before they do):**
- *Locally flat metric*: exact at $\bar\varphi$, error grows with segment length. With 6–7-vertex schematic centrelines the segments are kilometres long, so the corridor is a chain of straight quads, not a true offset curve.
- *Not a union*: one quadrilateral **per segment**, so the visual corridor is overlapping quads drawn at 0.22 alpha — overlaps double-darken. A real buffer (`ST_Buffer(geom::geography, r)` in PostGIS, or `@turf/buffer`) would dissolve them.
- *No round caps, no mitre joints*: concave bends leave small wedges/gaps.
- *Complexity:* $O(V)$ quads, recomputed on each radius change (cheap: 6 waterways × ~7 vertices).
- The UI labels it **"zona indikatif"** and the disclaimer explicitly denies it is a legal boundary or a flood extent. Correct framing.

### 3.5 Evacuation routing

**(a) Distance** — Haversine on a sphere, $R=6371$ km:

$$
a=\sin^2\!\tfrac{\Delta\varphi}{2}+\cos\varphi_1\cos\varphi_2\sin^2\!\tfrac{\Delta\lambda}{2},
\qquad
d=2R\arctan_2\!\big(\sqrt a,\ \sqrt{1-a}\big)
$$

**(b) Road factor and travel time** — a constant urban sinuosity:

$$
d_{\text{road}}=1.3\,d_{\text{great-circle}},\qquad
t_{\text{car}}=\max\!\big(3,\ \operatorname{round}(60\,d_{\text{road}}/25)\big),\qquad
t_{\text{walk}}=\max\!\big(5,\ \operatorname{round}(60\,d_{\text{road}}/4)\big)
$$

(25 km/h emergency urban speed; 4 km/h walking.)

**Worked example** — Antang (−5.1624, 119.4758) → GOR Andi Mattalatta (−5.1588, 119.4124):
$d=7.033$ km → $d_{\text{road}}=9.14$ km → **22 min by car, 137 min walking**.

**(c) Geometry** — the displayed polyline is **not** a road path: 4 waypoints (origin, two linear interpolations at 35 %/15 % and 75 %/85 % of the way, destination) — a staircase that "looks like" a route.

**Why this is acceptable and honestly stated:**
- the *usable* navigation output is the Google Maps deep link (`/maps/dir/?api=1&origin=…&destination=…&travelmode=driving`), which is a real router;
- the origin is the **first vertex of the polygon's first ring** (an arbitrary boundary vertex), not a road node;
- the destination is chosen by matching the kelurahan's `kecamatan` string to a shelter's `kecamatan` — a *jurisdictional* nearest, not a geometric nearest.

**"How would you make it real?"** → three options, ranked: (1) OSRM/Valhalla public API for driving/walking on OSM; (2) self-hosted OSRM with a Makassar extract; (3) `pgr_dijkstra` over an OSM `ways` table inside the existing PostGIS — the last keeps the stack single-database and is the academically strongest answer.

### 3.6 Scenario simulation model (client-side what-if)

$$
D_{\text{sim}}=\operatorname{clamp}_{0}^{150}\!\Big(\underbrace{\tfrac{R}{180}\cdot 75}_{75\%\ \text{rain}}
+\underbrace{\tfrac{T-0.3}{1.5}\cdot 30}_{\text{tide}}
+\underbrace{\operatorname{clamp}_{0}^{20}\!\big(\tfrac{I-180}{12}\big)}_{\text{static susceptibility}}
+\underbrace{10\cdot\mathbb{1}_{\text{coastal}}}_{\text{exposure}}\Big),\ \text{snapped to }5\text{ cm}
$$

**Term-by-term normalisation** — the defensible part: every term is bounded and its saturation point is explicit.

| term | input range | contribution | saturates at |
|---|---|---|---|
| rain $R$ | 0–180 mm/day | 0–75 cm | $R=180$ (BMKG "sangat lebat" ceiling) |
| tide $T$ | 0.30–1.80 m | 0–30 cm | $T=1.80$ |
| static $I$ | 100–500 | 0–20 cm | $I\ge420$ |
| coastal flag | boolean | 0 or 10 cm | — |
| **total** | — | **0–135 cm** | the 150 cm clamp **never binds** |

**Preset sanity check (use live):**

| preset | R | T | coastal | $D_{\text{sim}}$ at I=250 | class |
|---|---|---|---|---|---|
| Normal / Kemarau | 0 | 0.45 | no | **10 cm** | Aman |
| Hujan Monsun Lebat | 65 | 1.05 | no | 50 cm | Siaga |
| Puncak Pasang Rob | 20 | 1.52 | yes | 50 cm | Siaga/Bahaya |
| Katastrofik | 140 | 1.58 | yes | 100 cm | Bahaya |

**Class thresholds** (same shape as the DB model, different numbers):

```
very high : R ≥ 120  ∨  (R ≥ 70 ∧ T ≥ 1.35)  ∨  (coastal ∧ T ≥ 1.45)
high      : R ≥ 60   ∨  (basin ∧ R ≥ 40)     ∨  (coastal ∧ T ≥ 1.15)
moderate  : R ≥ 25   ∨  T ≥ 1.0
low       : otherwise
```

**Two weaknesses to volunteer**, with the physical reading:
1. **The "Normal/Kemarau" preset still reports 5–25 cm**, because the static-susceptibility term is unconditional. Concretely, at 0 mm rain and 0.45 m tide: $I=100\Rightarrow5$ cm, $I=250\Rightarrow10$, $I=300\Rightarrow15$, $I=500\Rightarrow25$. A "clear dry day" scenario showing 25 cm of standing water is indefensible; the fix is to gate the static term on the hydrological terms (or subtract a dry-day baseline).
2. **Class and depth are computed by two different formulas** and can disagree (see §8.3): at the Normal preset the badge reads **"Aman (Simulasi)"** while the depth card reads **10 cm**. One click exposes this.

### 3.7 Depth → impact classifier (human-scale figure)

`getDepthImpact(cm)` is a **6-band rule table**, and it is the most defensible part of the UI because the thresholds map to body dimensions and vehicle mechanics rather than to arbitrary numbers:

| band (cm) | severity | label | pedestrian / child / motorcycle / car |
|---|---|---|---|
| ≤ 0 | aman | Kering | normal / safe / all / all |
| 1–15 | rendah | Semata Kaki | waterproof footwear / slip risk in hidden holes / slow, watch potholes / all cars |
| 16–35 | waspada | Sebetis dewasa | heavy footing, avoid current / knee-deep for a child / **exhaust-pipe limit** / sedans splash risk |
| 36–60 | tinggi | Selutut dewasa | can knock an adult down / **critical** / **do not cross** / sedans stall or float |
| 61–100 | ekstrem | Sepinggang dewasa | impassable on foot / evacuate to upper floor / submerged / all passenger cars float |
| > 100 | bencana | Sedada ke atas | life-threatening / SAR boat only / washed away / vehicles become projectiles |

**Rendering geometry** (SVG, deterministic scale):
```js
groundY = 280 px, rulerHeight = 250 px for 200 cm  ⇒ 1.25 px/cm
adult = 170 cm → 212.5 px      child = 110 cm → 137.5 px
waterY = 280 − depth·1.25
```
The 170 cm adult and 110 cm child reference heights make the depth *readable* — the project's strongest science-communication argument, at a cost of 454 lines of SVG.

**Caveat:** the 35 cm motorcycle threshold is described as "the exhaust-pipe limit". Qualitatively right (typical motorcycle exhaust ≈ 25–40 cm from the ground) but a *generic* figure, not a per-vehicle measurement. Say "typical", never "the limit for motorcycles in Makassar".

---

## 4. Data model and SQL layer

### 4.1 Schema (inferred from every query in the repo — full DDL ships for only 3 of 7 tables)

```
kelurahan(id PK, kode_wilayah UNIQUE, nama_kelurahan, geom geometry(MultiPolygon,4326))
kelurahan_import(…)                                -- staging, recreated per import
curah_hujan(id?, kelurahan_id FK, waktu_pengamatan, nilai_mm, jenis_data, sumber, created_at)
potensi_banjir(id PK, kelurahan_id FK, waktu_analisis, hujan_mm, elevasi_m, tingkat,
               metode, indeks_kerawanan, estimasi_kedalaman_cm, kondisi_bmkg, sumber_model)
elevasi_kelurahan(kelurahan_id PK/FK, latitude, longitude, elevasi_titik_m, sumber, diperbarui_pada)
parameter_kerawanan_kelurahan(kelurahan_id PK/FK, 4 × skor SMALLINT CHECK 1..5,
                              4 × sumber TEXT NOT NULL, diperbarui_pada)
prakiraan_bmkg(id PK, kelurahan_id FK, kode_wilayah, waktu_prakiraan TIMESTAMPTZ,
               suhu_c, kelembapan_persen, kondisi_cuaca, sumber, created_at)
               + ix (kelurahan_id, waktu_prakiraan)
```

**Cardinality design.** `potensi_banjir` is maintained as **one row per kelurahan** (read-then-`UPDATE`-else-`INSERT`), so `/api/banjir` returns exactly 153 rows and the client can key on `kelurahan_id` safely. `curah_hujan` is **append-only** — one row per kelurahan per day ≈ **55 800 rows/year** — a deliberate time series with **no retention policy**.

**Integrity observations to state.** The 1:1 intent for `potensi_banjir(kelurahan_id)` is enforced **only in application code**, never by a `UNIQUE` constraint; that absence is precisely why the sync does a `SELECT`-then-write instead of one `ON CONFLICT` upsert. `prakiraan_bmkg` has the opposite defect: the code *assumes* a `UNIQUE(kode_wilayah, waktu_prakiraan)` that the DDL never creates.

### 4.2 Query patterns worth defending

| pattern | where | why it is right |
|---|---|---|
| `ST_AsGeoJSON(geom)::json` | `/api/kelurahan/geojson` | the `::json` cast makes psycopg return a Python `dict` → no double encoding, no string concat |
| `LEFT JOIN LATERAL (… ORDER BY … LIMIT 1) ON TRUE` | `rain_sync` | the textbook way to get "the next forecast per kelurahan" in one round trip instead of 153 correlated queries |
| `ST_PointOnSurface` | elevation ETL | guaranteed interior point, unlike `ST_Centroid` |
| `ON CONFLICT (kode_wilayah) DO UPDATE` | import & elevation | idempotent re-runs → the pipeline is safely re-executable |
| `engine.begin()` around the whole write loop | `rain_sync` | atomicity: the risk table never sees half a city updated |
| `pool_pre_ping=True` | `database.py` | survives idle-connection kills by the Supabase pooler |

### 4.3 Transaction and concurrency analysis

- The daily sync is **all-or-nothing** over 153 kelurahan (~459 statements in one transaction). Pro: no partial state. Con: one constraint violation discards everything, and locks are held for the whole loop.
- **No advisory lock, no idempotency key**: two overlapping runs (cron + a manual `GET /api/cron/sync-weather`) both read then both write. `potensi_banjir` is last-writer-wins; `curah_hujan` accumulates duplicate timestamped rows.
- The cron endpoint is **unauthenticated** → anyone can trigger a write-heavy job.
- `last_sync_info` is **process-local memory**: on serverless, `/api/sync-status` reflects whichever instance answered and resets on cold start.

---

## 5. API layer

### 5.1 Endpoint contract

| # | Route | Method | SQL / behaviour | Consumed by |
|---|---|---|---|---|
| 1 | `/` | GET | serves `frontend/dist/index.html` if built, else a JSON banner | browser (Docker mode) |
| 2 | `/api/health` | GET | `current_database()`, `PostGIS_Version()`, `COUNT(kelurahan)`; 503 on failure | ops |
| 3 | `/api/cron/sync-weather` | GET | runs the ETL synchronously | Vercel cron |
| 4 | `/api/sync-status` | GET | echoes in-memory `last_sync_info` | ops |
| 5 | `/api/kelurahan?q=` | GET | `ILIKE %q%`, `LIMIT 100` | **unused** |
| 6 | `/api/kelurahan/geojson` | GET | 153 features × 3 properties | **map bootstrap** |
| 7 | `/api/kelurahan/{id}/hujan-terbaru` | GET | latest rainfall row | **unused** |
| 8 | `/api/banjir` | GET | one risk row per kelurahan (11 fields) | **choropleth** |
| 9 | `/api/bmkg/prakiraan/{kode}` **and** `/api/prakiraan/{kode}` | GET | ≤ 20 forecast rows, 6-hour look-back with a "most recent" fallback | **forecast panel** |
| 10 | `/api/maritim/pasut` | GET | Open-Meteo Marine → M2 transform | **tide widget** |

**Client usage: 4 of 10 handlers.** A legitimate slide ("the API was built slightly ahead of the UI"), but be ready for *"why ship endpoints nobody calls?"* → they exist for `sync_prakiraan_bmkg.py`, monitoring (`health`, `sync-status`), and a per-kelurahan rainfall panel that is designed but not mounted.

### 5.2 Transport and middleware facts

- **CORS:** `allow_origins` from `CORS_ORIGINS` (default `localhost:5173`) **plus** `allow_origin_regex=r"https://.*\.vercel\.app"` with `allow_credentials=True`. *Attack surface:* every Vercel preview domain on the internet is allow-listed. Cookies aren't used, so practical impact is low — say that, then say you'd replace the regex with explicit origins.
- **No response models** → `/docs` shows untyped schemas; serialisation relies on `jsonable_encoder` (`Decimal→float`, `datetime→ISO-8601`).
- **No compression middleware.** The GeoJSON payload is ≈ **780 KB** uncompressed and ≈ **245 KB** gzip'd (measured). A `GZipMiddleware(minimum_size=1000)` or an edge cache is a one-line, 3.2× win. *(Verify your host: `curl -H 'Accept-Encoding: gzip' -sI <url>/api/kelurahan/geojson | grep -i content-encoding`.)*
- **No caching headers** on any endpoint → every page load re-serialises 27 130 vertices from PostGIS.
- **Error handling:** every handler wraps its body in `try/except` and returns `HTTPException(500, str(exc))` → raw driver messages reach the client (information disclosure) and, in one case, a deliberate 404 becomes a 500 (§8.2).

### 5.3 Serverless specifics
- `api/index.py` prepends `backend/` to `sys.path` so `from app.main import app` resolves inside Vercel's function sandbox.
- The cron is declared in `backend/vercel.json` (`0 0 * * *`) and hits an endpoint that **always returns HTTP 200**, even on failure → the scheduler cannot detect failure.
- A function that runs a 153-row, 4-HTTP-call ETL is at risk of the platform timeout. The production-grade answer: chunk it (e.g. 50 kelurahan per invocation behind a cursor), or move the job to a real worker.

---

## 6. Frontend architecture

### 6.1 State graph

26 `useState`, 4 `useEffect`, 3 `useMemo`, 5 `useCallback` in `App.jsx`; 7 `useEffect`, 6 `useMemo`, 3 `useCallback` in `FloodMap.jsx`. Grouped by concern:

```
data plane    : geojson, banjir, prakiraan, loading/error flags, forecastRequestVersion
view plane    : theme, viewMode, activeSidebarMenu, isSidebarCollapsed, mobileModalActive,
                search, filter, isSearchFocusedMobile, selectedKelurahan
domain plane  : isSimulation, simulationState, activeRoute, activeBufferRiver, bufferRadius,
                bufferToolOpen, facilityCategory, focusedPosko, simulationModalOpen, waterSimulatorOpen
```

The rule is: **map data and selection live in `App`; purely local UI (which tab, which popover) lives in the child.**

### 6.2 Render pipeline — one frame in simulation mode

```
slider onChange
  → setSimulationState (new object)
  → App re-render
      → summary useMemo recomputes            (153 × classification)
      → FloodMap re-render
          → getFeatureRisk recreated          (useCallback deps changed)
          → filteredGeojson useMemo recomputes (153 × getFeatureRisk)
          → GeoJSON `key` changes             (it embeds JSON.stringify(simulationState))
              → **the entire 163-path Leaflet layer is destroyed and rebuilt**
          → header chips + legend counts update
```

**The remount is what makes restyling work at all.** react-leaflet applies `style` only to *newly created* layers, so the only reliable way to recolour 153 polygons is to recreate them. The cost: per keystroke in the search box and per slider tick, **163 Leaflet path elements + 163 tooltip bindings** are thrown away — visible jank on mid-range Android. **Better design to propose:** keep the layer and call `layer.setStyle()` per polygon from a `useEffect` over a ref'd `FeatureGroup` — $O(n)$ style writes, no DOM churn.

### 6.3 Derived-data structures

Three `Map` indexes built from props:
```js
banjirMap  : kelurahan_id | nama_kelurahan → risk row
elevasiMap : kelurahan_id | nama_kelurahan → elevation
hujanMap   : kelurahan_id | nama_kelurahan → rainfall
```
Double keying means a lookup succeeds whichever identifier the caller holds. **Verified safe for the current dataset** (153 unique names, 153 unique codes). If two kecamatan ever share a kelurahan name — common in Indonesia — the last one wins and the map mis-colours. One sentence, and it shows you thought about it.

### 6.4 Layout strategy and accessibility
- Two full trees; state in `App` means switching layout preserves everything.
- Auto-switch uses **hysteresis** (< 640 px → mobile, ≥ 1024 px → laptop, nothing in between) with a 200 ms debounce — the professional fix for layout thrash.
- Accessibility present: `role="dialog"`, `aria-modal`, `aria-label` on every icon-only button, `role="checkbox"` + `tabIndex` + Enter/Space on checklist items, `role="img"` + a descriptive `aria-label` on the depth SVG, `role="status"` on toasts.
- Accessibility missing: **no focus trap** in modals, no Escape-to-close, `user-scalable=no` in the viewport meta, and emoji-only affordances in the sidebar rail.

### 6.5 Design system
52 CSS custom properties on `:root`, overridden wholesale by `[data-theme="light"]` — so **no component is theme-aware**; one attribute on `<html>` repaints the app. 7 075 lines of hand-written CSS, 12 media queries, 5 keyframe animations. Cost: no scoping, duplicated blocks, and a dead 344-line `App.css`.

---

## 7. Measured performance profile

| Measurement | Value | Method |
|---|---|---|
| `/api/kelurahan/geojson` body (3 properties, 2D) | **≈ 780 KB** | serialised the exact response shape |
| … after `gzip -9` | **≈ 245 KB (31 %)** | measured |
| source GeoJSON file (all BIG attributes) | 1.26 MB → gzip 329 KB | measured |
| vertices / polygons / rings | 27 130 / 163 / 163 | measured |
| Leaflet `path` elements created on map mount | **163** (+ 163 tooltip bindings) | = ring count |
| payload with coordinates rounded to 5 dp (≈1 m) | 718 KB vs 1 289 KB with full attributes (**−44 %**) | measured |
| `/api/banjir` body | 153 rows × ~250 B ≈ **38 KB** | estimate from field list |
| forecast rows returned | ≤ 20 (3-hourly ⇒ ≈ **60 h horizon**) | code |
| ETL external requests | **⌈153/50⌉ = 4** | code |
| ETL DB statements | 153 `INSERT` + 153 `SELECT` + ≤153 `UPDATE` ≈ **459** | code |
| `curah_hujan` growth | 153 rows/day ≈ **55.8 k rows/year** | arithmetic |
| tide widget polling | 1 request / 5 min / open widget | code |

**Complexity**

| operation | complexity | note |
|---|---|---|
| risk model | $O(n)$, $n=153$ | trivial |
| risk read query | $O(n)$ | joins on primary keys |
| GeoJSON serialisation | $O(V)=O(27\,130)$ | linear in vertices; the dominant server cost |
| client search/filter | $O(n)$ + **$O(V)$ layer rebuild** | the rebuild is the real cost |
| buffer build | $O(V_{\text{river}})$ quads | ~7 vertices per waterway |
| routing | $O(1)$ | closed form |

**Optimisation backlog, ranked by impact ÷ effort:**

| # | change | impact |
|---|---|---|
| 1 | `GZipMiddleware` or edge compression | −69 % transfer, 1 line |
| 2 | `ST_SimplifyPreserveTopology(geom, 0.0001)` + `ST_AsGeoJSON(geom, 6)` | −40–60 % payload, no visible change at city zoom |
| 3 | `Cache-Control: public, max-age=3600` + ETag on `/geojson` and `/banjir` | eliminates repeat transfer |
| 4 | replace the `key`-remount with `setStyle()` on a feature group | removes per-keystroke jank |
| 5 | `UNIQUE(kelurahan_id)` on `potensi_banjir` → single `ON CONFLICT` upsert | 459 statements → ~153 |
| 6 | chunk the ETL for serverless timeouts | robustness |

---

## 8. Correctness analysis — the divergences, quantified

This section is your armour. Every item is **verifiable in the code**, and each has a prepared answer. Demonstrating that you *know* these is worth more than pretending they don't exist.

### 8.1 The BMKG path is circular (highest priority)
`sync_prakiraan_bmkg.py` calls `http://127.0.0.1:8000/api/bmkg/prakiraan/{kode}` — **our own endpoint**, which reads `prakiraan_bmkg`, the table the script writes. Nothing in the repo calls `api.bmkg.go.id`. Two further defects: `ON CONFLICT (kode_wilayah, waktu_prakiraan)` has no matching unique constraint in the shipped DDL, and the upsert sets `diambil_pada`, a column the DDL never creates.

**Answer:** *"BMKG ingestion is scaffolded but not live: the table, the endpoint, the field-normalisation adapter (`normalisasiPrakiraan`, which already parses BMKG's `data[].cuaca[][]` shape), the sample payload (`bmkg_test.json`) and the sync script all exist; the missing link is the HTTP client that calls BMKG. Until then the forecast panel shows what is stored — and says so when the list is empty."* Then show the adapter parsing `bmkg_test.json`: that proves the integration point is real, merely unwired.

### 8.2 Other confirmed defects

| # | defect | evidence | severity |
|---|---|---|---|
| 1 | `/api/kelurahan/{id}/hujan-terbaru` turns its own 404 into a 500 | `raise HTTPException(404)` inside the `try` that catches `Exception` | low |
| 2 | forecast fallback sorted **DESC** → the time series renders backwards | second query in `get_prakiraan` | medium |
| 3 | tide endpoint returns HTTP 200 + hard-coded numbers on *any* failure | `except` returns `status:"offline_fallback"` | medium (calm values during an outage) |
| 4 | `CAST(:waktu AS timestamp)` drops the timezone on a `TIMESTAMPTZ` column | `sync_prakiraan_bmkg.py` | medium (8 h shift) |
| 5 | daily sync silently no-ops if `parameter_kerawanan_kelurahan` is empty, and blames coordinates | INNER JOIN + misleading `pesan` | medium |
| 6 | `hujanTerbaru={0}` hard-coded → "today's rain" always reads 0 mm | both `RainfallInsight` call sites | low–medium |
| 7 | `GET /` serves the SPA but never mounts `StaticFiles` for `/assets` | `main.py` | **high** for the Docker path only (split deploy unaffected) |
| 8 | root `vercel.json` targets a non-existent `api/main.py` | file content | high if deployed from root |
| 9 | `COPY backend/ ./` copies the committed **Windows** venv over the container's Linux venv (`pyvenv.cfg`, `Scripts/` vs `bin/`); no `.dockerignore` exists | Dockerfile | high for image integrity |
| 10 | compare mode, waterway layer and `WaterHeightSimulatorModal` are **unreachable** (setters never called) | `setCompareMode`, `setShowKanal`, `setWaterSimulatorOpen` | medium (dead feature; demo risk) |
| 11 | `requirements.txt` omits **geopandas, pandas, numpy, shapely** (needed by the ETL) and rasterio/rasterstats entirely → the ETL only runs from the committed venv | requirements vs `site-packages` | high for reproducibility |
| 12 | `backend/.env` with a **live Supabase password** is committed; 9 179 of 9 254 tracked files are that venv | `git ls-files` | **critical** — rotate before presenting |

### 8.3 The three risk engines disagree — quantified

There are **three independent implementations** of the same classification: `FloodMap.getFeatureRisk` (colours), `App.summary` (counters), `App.handleSelectKelurahan` (detail panel). They differ in the basin/coastal gate:

| rule term | `FloodMap` (colours) | `App.summary` (counts) | `App.handleSelectKelurahan` (panel) |
|---|---|---|---|
| `isBasin && rain ≥ 40 → high` | ✅ | ✅ | ❌ **missing** |
| coastal detection | 7 names **+** real elevation | 6 names + a hard-coded `const e = 5` (dead branch) | 7 names |
| `elevasiData` actually supplied? | **never** (prop defaults to `[]`) | n/a | n/a |

**Divergence region (exact).** For the 5 basin kelurahan (Antang, Manggala, Tamalanrea, Tamangapa, Karunrung), any $R\in[40,60)$ mm with $T<1.15$ m yields **map = "Siaga" / panel = "Waspada"**. On the 5 mm-stepped rain slider that is 4 of 37 values (10.8 %), and 17 of 31 tide values (54.8 %) → **≈ 5.9 % of the scenario surface** for those kelurahan.

**Answer:** *"Yes — three code paths normalise the same rule and one dropped a term. It is a refactor defect, not a model defect. The fix is one shared `classifyRisk(rain, tide, elev, name)` module; here is the 5.9 % divergence table I measured."* (Put the table in the appendix.)

### 8.4 Unit and precision discipline (what *is* consistent)

| quantity | unit | source of truth | consistent? |
|---|---|---|---|
| rainfall | mm/day | `curah_hujan.nilai_mm`, `hujan_mm` | ✅ |
| elevation | m above MSL | `elevasi_titik_m`, `elevasi_m` | ✅ |
| depth | **cm**, integer, 5 cm grid | `estimasi_kedalaman_cm` | ✅ everywhere (never mixed with m in the UI) |
| tide | m, 2 dp | `total_elevasi_m` | ✅ |
| distance | km, 2 dp | `jarakKm` | ✅ |
| time | WITA (UTC+8) for display, UTC for storage | `waktu_analisis` vs `waktu_wita` | ⚠️ mixed but systematic |
| coordinates | WGS84 / EPSG:4326 | DB + tiles | ✅ |

Say: *"Every user-facing number carries an explicit unit and a quantisation; the m-vs-cm mixing layer does not exist because depth is always cm."*

### 8.5 What "validation" means here (prepare this answer carefully)
No calibration or validation dataset is included. The defensible framing, in three steps:

1. **Conceptual validation** — the five criteria and their weights follow the cited method (Nurliah et al. 2025) for Indonesian urban flood susceptibility; land-use-dominant weighting is consistent with that literature.
2. **Plausibility check** — the high-risk kelurahan in the code's own priors (Antang, Tamangapa, Tallo, Buloa, Camba Berua, Mariso) match Makassar's repeatedly reported flood hot-spots, and the simulator's ordering (coastal + basin > inland + high) is physically sensible.
3. **What is missing, and exactly how you would do it** — (a) compare the class map against a historical flood-point inventory (BPBD/BNPB reports, geocoded news) and report a confusion matrix / AUC; (b) leave-one-out sensitivity on the five weights; (c) compare the depth surrogate against surveyed high-water marks from 2–3 past events. Naming the *specific* validation you would run is the answer that satisfies an examiner.

---

## 9. Limitation register (volunteer these)

| # | Limitation | Why it exists | Mitigation in the current design |
|---|---|---|---|
| 1 | No hydrodynamic modelling | needs a 2D solver + surveyed DEM/bathymetry + boundary conditions | depth is labelled a communication surrogate, in code and in the UI |
| 2 | One point elevation per kelurahan | elevation sampled once from a 90 m DEM | the zonal-statistics script exists; loading it is the next step |
| 3 | Static scores are not derived in code | requires land-use/soil/river/slope overlays | the table forces `1..5` + a provenance string per criterion |
| 4 | BMKG not live | ingestion unwired (§8.1) | forecast panel degrades explicitly when empty |
| 5 | Tide is a 1-constituent synthetic model | no harmonic constants | clearly labelled; the marine wave data *is* live |
| 6 | Routing is schematic | no road graph | the Google Maps deep link is the real router |
| 7 | Buffer is one quad per segment | no geometry library | labelled "zona indikatif" |
| 8 | Shelters/facilities/waterways are curated static lists (12/12/6) | no BPBD API | provenance in file headers; trivially swappable for an API |
| 9 | No accounts, no persistence of citizen reports | out of scope | the screen-share/deep-link is what the UI actually promises |
| 10 | No automated tests, no CI | prototype scope | see the backlog (§14) |
| 11 | Committed credentials + venv | development hygiene failure | rotate + `.gitignore` + `.dockerignore` — do this **before** the presentation |

---

## 10. Viva Q&A — 32 prepared answers

**Architecture and stack**

1. **"Why PostGIS and not just files?"** → Server-side geometry operations (validity repair, `ST_Multi`, `PointOnSurface`, `AsGeoJSON`), one authoritative source, and the 153 polygons stay correct if the client is rewritten. Files would duplicate the truth into the bundle.
2. **"Why FastAPI?"** → Async third-party calls, automatic `/docs`, parameter validation, and trivial deployment to Vercel or a container. Django/Flask add weight for 10 endpoints.
3. **"Why no ORM?"** → The read path is collection-shaped (build a FeatureCollection; "next forecast per kelurahan"), which ORMs express worse than SQL. Raw `text()` keeps it reviewable and avoids N+1. Trade-off: no compile-time safety — which is why the contract is documented in comments next to each query.
4. **"Why a separate mobile layout?"** → The mobile experience is bottom-sheet + chip-rail, not a shrunken desktop. Two trees cost duplication but avoid a media-query monolith; state lives in `App`, so switching is lossless.
5. **"Why no state library?"** → The graph is one level deep and small; 26 `useState` in one component is the accepted trade-off, and the extraction to hooks is identified as backlog.

**The model**

6. **"Explain your model in one minute."** → Five criteria scored 1–5 with weights 35/25/20/10/10 → index 100–500 → four classes; then a monotone rescale to a 0–120 cm depth surrogate for public communication. Rainfall is a *categorical* BMKG condition score, deliberately not millimetres.
7. **"Why those weights?"** → Adapted from the cited Indonesian urban-flood susceptibility method; land-use dominant because imperviousness and river proximity dominate urban flooding. Sensitivity: one land-use step = 3.5 slope steps (§3.1).
8. **"Is the index normally distributed / why so few 'very high'?"** → Uniformly over the 3 125 score combinations: 17.9 / 49.0 / 30.4 / 2.7 %. The red class is rare **by construction of the lattice**, not by Makassar's geography — which is why the class map must not be read as an absolute frequency claim.
9. **"How do you validate?"** → §8.5, word for word, ending with the three concrete validation designs.
10. **"Why is depth capped at 120 cm?"** → The index maps onto 0–120 cm so the number stays inside the readable band of the human-scale figure and never implies precision the index cannot support (25 buckets at 5 cm).
11. **"Why not machine learning?"** → No labelled flood inventory exists to train on; a transparent weighted overlay is auditable, explainable to citizens, and safer for a public tool. ML is future work, *conditional on* building a flood-point dataset first.
12. **"What is your novelty?"** → Not the model — the **integration and the communication layer**: PostGIS → operational forecast/marine feeds → a citizen-legible choropleth with depth-vs-human visualisation, scenario what-if and evacuation support, in one dependency-light stack.

**Data**

13. **"Where do the boundaries come from?"** → BIG/BAPANAS ArcGIS REST, `outSR=4326`, 153 features, 15 kecamatan, verified unique codes.
14. **"How do you handle bad geometry?"** → `make_valid` → `CollectionExtract(…,3)` → `Force2D` → `Multi` → typed `geometry(MultiPolygon,4326)`, with empty/duplicate filtering and a staging table validated before the swap.
15. **"What if the CRS is unknown?"** → The importer aborts (`"Jangan menebak CRS sumber"`). Never guess a CRS.
16. **"Where does elevation come from and how accurate?"** → Copernicus GLO-90 via Open-Meteo at `PointOnSurface`; 90 m posting and a *single point per kelurahan* — intra-kelurahan variation is not modelled. The zonal-statistics script that would give min/mean/max exists but its output is not loaded.
17. **"How fresh is the data?"** → Rainfall + risk: daily (cron 08:00 WITA). Forecast: whatever is stored in `prakiraan_bmkg` (BMKG ingestion pending). Marine: live per request; the widget polls every 5 minutes.
18. **"What about timezones?"** → Storage is UTC (`TIMESTAMPTZ`), display is WITA = UTC+8 (the tide clock adds 8 h explicitly); one known defect converts forecast timestamps with `CAST(… AS timestamp)`, which drops the offset.

**Engineering**

19. **"How does it scale to 10 000 polygons?"** → The read path is linear, but the *payload* is the bottleneck: vector tiles (MVT / `ST_AsMVT`) plus simplification is the answer, not bigger servers. Quote the measured numbers (780 KB / 27 k vertices).
20. **"Biggest performance problem?"** → GeoJSON transport (no gzip/simplify/cache) and the client-side layer remount on every interaction; both are ranked in §7 with fixes.
21. **"How do you handle API failure?"** → Explicit degradation: polygons fatal (blocking error), risk rows optional (grey "no data" class), forecast an explicit empty state with retry, tide falls back to the local model — the last one is arguably too silent, and I'd surface it.
22. **"Is it secure?"** → Before presenting: rotate the committed DB credential, `.gitignore` the venv/env, add `.dockerignore`, narrow the CORS regex, protect the cron endpoint. Reciting this list turns a weakness into evidence of judgement.
23. **"Tests?"** → None currently. Highest-value first: (a) pure-function unit tests for `calculate_risk` / `getDepthImpact` / Haversine (zero setup), (b) a golden-file test of the GeoJSON response shape, (c) a Playwright smoke test "load → click polygon → panel shows a depth".
24. **"Why is depth different between the map popup and the panel in simulation mode?"** → Three code paths implement the same rule and one dropped the basin term (§8.3); measured divergence ≈ 5.9 % of the parameter surface. Fix: one shared classifier.

**Domain and product**

25. **"Who is the user?"** → Two: citizens ("is my kelurahan at risk, what do I do now") and the academic evaluation. Every screen is plain Indonesian with an explicit "what does this mean for me".
26. **"Could this be mistaken for an official warning?"** → That is why the disclaimers are structural, not decorative: `DataSourceInfo` states it is not AWLR-based, the depth is called illustrative, the buffer is "indicative", the route card distinguishes simulation from verified, and the forecast panel says "forecast, not observation".
27. **"Why 112?"** → Makassar's free unified emergency line; hard-coded as `tel:112` plus a pre-filled BPBD WhatsApp deep link.
28. **"Why the Paotere station?"** → It is the reference port for the Makassar Strait; coordinates are pinned in the endpoint (−5.12, 119.40).
29. **"Scale of the study area?"** → 153 kelurahan across 15 kecamatan; the map opens at zoom 12 centred on −5.1477, 119.4327.
30. **"What data would you add first?"** → Three: (a) a historical flood-point inventory (validation), (b) AWLR/tide-gauge series (replaces the synthetic tide), (c) an OSM road graph in the same PostGIS (real routing).
31. **"If you had two more weeks?"** → The backlog in §14, in order: wire BMKG → fix the three-engine divergence → gzip/simplify/cache → shared classifier → tests/CI.
32. **"What did you personally learn?"** → Answer honestly with one technical (geometry validity / CRS discipline / react-leaflet's restyle constraint) and one methodological (the honesty constraints when publishing risk to the public).

---

## 11. Live demo script (7 minutes, rehearsed)

| t | action | say this |
|---|---|---|
| 0:00 | load the laptop view | "One map, 153 kelurahan, dark cartographic basemap so the risk choropleth is the figure, not the roads." |
| 0:30 | hover polygons | "Colour = susceptibility class; the tooltip gives name and class; the header counts use the same classifier." |
| 0:50 | click a coastal kelurahan (Mariso / Tallo) | "Selection fits the polygon and opens the panel; the depth card is a **surrogate**, and the human-scale figure is how a citizen reads 90 cm." |
| 1:30 | open the Cuaca tab | "Forecast cards: time, condition, temperature, humidity — explicitly labelled forecast, not observation." |
| 2:00 | Posko → focus → route | "Route card: 9.1 km, 22 min by car; the polyline is schematic, the Google Maps link is the real navigation." |
| 2:45 | open the tide drawer | "Live wave height and current from Open-Meteo Marine; the tide curve is a documented M2 model — and here is the compound-flood explanation." |
| 3:30 | open the simulator, drag rain to 140 | "Every kelurahan reclassifies from its own susceptibility index plus the scenario — this is the what-if the project is built around." |
| 4:15 | show the Normal preset | "And here is a defect I found and can explain: the dry-day preset still reports 5–25 cm because the static term is unconditional. That is the calibration fix in my backlog." |
| 5:00 | canal buffer, 100 → 500 m | "Corridor built in degrees with a local metric; it is a quadrilateral-per-segment approximation, labelled indicative." |
| 5:40 | mobile mode | "Not a shrunken desktop: bottom sheet with three snap states, a chip rail for layers, modals for guidance." |
| 6:15 | `/docs` in another tab | "10 endpoints, 4 used by the client; health and sync-status are ops affordances." |

**Demo safety checklist:** start the backend and hit `/api/health` first; pre-warm the page once (tiles + GeoJSON cached); keep a screenshot set of every panel. If the network drops, the tide widget will show its fallback numbers — narrate that as designed behaviour, because it is.

---

## 12. Slide deck outline (12 slides)

1. **Title** — JeneBosi: WebGIS kesiapsiagaan banjir Kota Makassar; 153 kelurahan; authors.
2. **Problem** — Makassar's compound flooding (pluvial + fluvial + tidal); citizens get colours without meaning; no integrated public tool at kelurahan level.
3. **Objective and scope** — integrate authoritative geospatial data and operational forecasts into one legible interface; explicitly **not** a hydrodynamic model.
4. **Architecture** — the four-layer diagram (§1.1) plus "why PostGIS / FastAPI / React-Leaflet".
5. **Data pipeline** — the six stages (§2) with the verification numbers (153 / 163 / 27 130 vertices; 4 HTTP calls; per-batch isolation).
6. **Risk model** — formula, weights, sensitivity table, class distribution (§3.1). *Core slide.*
7. **Depth surrogate and communication** — index→cm mapping, the 6-band impact table, the human-scale SVG (§3.2, §3.7).
8. **Dynamic components** — tide M2 model and thresholds; simulation model with its term bounds (§3.3, §3.6).
9. **Spatial analysis** — buffer derivation and error analysis; routing and Haversine (§3.4, §3.5).
10. **Engineering** — measured performance table and optimisation ranking (§7); state graph and the remount trade-off (§6.2).
11. **Limitations and honesty** — the register (§9) plus the three-engine divergence you found and measured (§8.3). *Examiners reward this slide more than any other.*
12. **Roadmap and conclusion** — BMKG ingestion, routing in PostGIS, validation against a flood-point inventory, tests/CI (§14).

---

## 13. Numbers cheat-sheet (print this)

```
KELURAHAN        153 features · 15 kecamatan · 163 polygons · 163 rings · 27 130 vertices
                 most detailed Barombong (684 v) · least Butung (17 v)
                 149 Polygon + 4 MultiPolygon in source · 153 unique names + codes
RISK INDEX       I = 35·landuse + 25·rain + 20·river + 10·soil + 10·slope  → 100..500, 77 distinct values
CLASSES          ≤230 Rendah · ≤330 Sedang · ≤430 Tinggi · >430 Sangat Tinggi
UNIFORM PRIOR    17.9 / 49.0 / 30.4 / 2.7 %   mean 300, median 300, σ 70
SENSITIVITY      one score step = +35 / +25 / +20 / +10 / +10 index points
DEPTH            D = clamp(0,120, 5·round((I−100)/400 · 24)) → 25 buckets; I=500 → 120 cm
RAIN SCORE       ekstrem|petir|lebat→5 · hujan→4 · berawan|kabut→2 · else→1
TIDE             h = 0.9 + 0.65·cos(2πt/12.42) + 0.1·H_wave   max 1.55 m, min 0.25 m
TIDE THRESHOLDS  ≥1.40 ekstrem (4 h/day) · ≥1.10 waspada (9 h/day)
SIM DEPTH        (R/180)·75 + ((T−0.3)/1.5)·30 + clamp(0,20,(I−180)/12) + 10·coastal
                 clamp 0..150 but max reachable = 135 cm
SIM CLASSES      VH: R≥120 ∨ (R≥70∧T≥1.35) ∨ (coast∧T≥1.45)
                 H : R≥60 ∨ (basin∧R≥40) ∨ (coast∧T≥1.15)      M: R≥25 ∨ T≥1.0
IMPACT BANDS     0 | ≤15 | ≤35 | ≤60 | ≤100 | >100 cm   (6 bands)
ROUTING          road = 1.3 × haversine · car 25 km/h · walk 4 km/h
                 Antang → GOR Andi Mattalatta: 7.03 km straight → 9.14 km → 22 min / 137 min
BUFFER           m/° lat 110 540 · m/° lon 111 320·cos φ (≈110 871 at −5.15°)
                 250 m ≈ 0.00226° longitude
PAYLOAD          /geojson ≈ 780 KB (gzip 245 KB) · 163 path elements · /banjir ≈ 38 KB
ETL              ⌈153/50⌉ = 4 HTTP calls · ~459 DB statements · 55.8 k rows/year
SVG SCALE        1.25 px/cm · ground y = 280 · adult 170 cm = 212.5 px · child 110 cm = 137.5 px
STACK            FastAPI 0.143 · SQLAlchemy 2.1 · psycopg 3.3 · PostGIS
                 React 19 · Leaflet 1.9 · react-leaflet 5 · Vite 8 · Python 3.12
```

---

## 14. Backlog (prioritised — use this for the roadmap slide)

| # | item | type | effort | impact |
|---|---|---|---|---|
| 1 | **Rotate the leaked DB password**; root `.gitignore` (`.venv`, `.env`, `__pycache__`), `.dockerignore`, `git rm -r --cached backend/.venv` | security | 1 h | critical |
| 2 | Wire BMKG ingestion (`api.bmkg.go.id` → `prakiraan_bmkg`), add `UNIQUE(kode_wilayah, waktu_prakiraan)` + `diambil_pada`, remove the circular sync | correctness | 1 d | high — makes the headline feature real |
| 3 | One shared `classifyRisk()` for map, counters and panel; fix the dry-day static term | correctness | 4 h | high |
| 4 | gzip + `ST_SimplifyPreserveTopology` + `ST_AsGeoJSON(geom,6)` + `Cache-Control`/ETag | performance | 3 h | high |
| 5 | Replace the `key`-remount with `setStyle()` on a feature group | performance | 4 h | medium |
| 6 | `UNIQUE(kelurahan_id)` on `potensi_banjir` → single `ON CONFLICT` upsert; chunk the ETL | reliability | 3 h | medium |
| 7 | Mount `StaticFiles` for `/assets`; fix root `vercel.json` | deployment | 1 h | medium |
| 8 | Protect `/api/cron/sync-weather` (`CRON_SECRET`), return non-2xx on failure, make it `def` (threadpool) | security/robustness | 1 h | medium |
| 9 | `GZipMiddleware`; narrow the CORS regex; stop echoing DB errors | security | 1 h | medium |
| 10 | Tests: unit-test the pure functions, golden-file the GeoJSON shape, one Playwright smoke test, CI | quality | 1–2 d | high (academic credibility) |
| 11 | Load `hitung_elevasi.py`'s zonal stats (min/mean/max) and feed `elevasiData` into `FloodMap` — this also revives the dead `elev < 4.5` coastal branch | model quality | 4 h | medium |
| 12 | Real routing: OSM `ways` → `pgr_dijkstra` in the existing PostGIS | feature | 2–3 d | high (flagship) |
| 13 | Validate against a historical flood-point inventory (confusion matrix / AUC); sensitivity on the five weights | science | 3–5 d | **highest academic value** |
| 14 | Split `App.jsx` into hooks + two layout components; delete `App.css` and `IntroSection.jsx` | maintainability | 1 d | medium |

---

### Final advice for the room

- **Lead with the framing, not the features.** "Decision-support and communication layer, explicitly not a hydrodynamic model" pre-empts the single most damaging question.
- **Own §3.1's sensitivity table and §8.3's divergence table.** Measured self-criticism reads as maturity; hiding a defect a lecturer finds in 30 seconds reads as the opposite.
- **Never say "prediction", "real-time monitoring", "accurate depth", or "official".** Use *susceptibility*, *indicative*, *surrogate*, *forecast*, *prototype*. The vocabulary does the defensive work.
- **If you don't know: say what you would measure to find out.** That is the only answer that never loses marks.
