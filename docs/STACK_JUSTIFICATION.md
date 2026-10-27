# Why FastAPI and Python — stack justification for the viva

**The one-sentence answer**

> Python was chosen because **the hard part of this project is geospatial data preparation, and that toolchain (GDAL/GEOS/PROJ bindings: GeoPandas, Shapely, Rasterio, Rasterstats) exists essentially only in Python** — and FastAPI was chosen because it turns a small Python data API into a documented, async-capable, deployable service with almost no boilerplate.

Note the order: **Python is the strategic decision; FastAPI is the ergonomic one.** Say it in that order — it shows you understand *why* the stack exists rather than reciting framework marketing.

---

## 1. The decisive reason: the geospatial toolchain is Python

This is the argument that cannot be beaten, and it is verifiable from your own repository:

| Tool | Used in your code | What it does that would otherwise be manual work |
|---|---|---|
| **GeoPandas** | `import_kelurahan.py` (`gpd.read_file`, `to_crs`, `make_valid`, `to_postgis`) | read GeoJSON/Shapefile, reproject, repair geometry, bulk-load into PostGIS in one call |
| **Shapely** (via GeoPandas) | `make_valid`, `geom_type` filters | geometry validity repair — the single most common failure in real administrative data |
| **Pandas** | `import_kelurahan.py`, `hitung_elevasi.py` | column-wise cleaning, `fillna` fallbacks between `KDEPUM`/`KDEBPS`, dedupe |
| **Rasterio** | `hitung_elevasi.py` | open a GeoTIFF DEM, read its CRS and nodata metadata |
| **Rasterstats** | `hitung_elevasi.py` | **zonal statistics** — per-polygon min/mean/max of a raster in 6 lines |
| **NumPy** | transitively | array maths over 90 m DEM tiles |

Underneath all of them is **GDAL/OGR/PROJ**, the reference implementation of geospatial formats and coordinate transforms. There is no maintained Node.js equivalent: a JavaScript project would either shell out to GDAL CLI binaries (fragile, hard to deploy on serverless) or push the work into the database and lose the ability to inspect intermediate results.

**Say this in the viva:**
> "My pipeline is: fetch boundaries → validate and repair geometry → reproject → load into PostGIS → sample a 90 m DEM → compute zonal statistics → score risk. Every step after the first is a Python geospatial library call. In Node I would have had to reimplement or shell out to GDAL for four of those six steps, and the two-hour import script would have become a two-day task."

### The secondary Python reasons (real but weaker)

| Reason | Evidence in your repo |
|---|---|
| **One language for ETL + API + model** | `flood_risk_model.py` is imported by the API *and* by the cron job; `database.py` is shared by six scripts and the app. No language boundary between "data engineering" and "web service". |
| **Mature, boring database bindings** | `psycopg` 3 (the maintained PostgreSQL driver with binary protocol) + SQLAlchemy 2.1 Core + GeoAlchemy2 for PostGIS types. |
| **Readable, reviewable, teachable** | `flood_risk_model.py` is 49 lines a lecturer can audit in 60 seconds — relevant when the deliverable is academic, not commercial. |
| **Cheap, flexible deployment** | the same `app` object runs under `uvicorn` locally, in a `python:3.12-slim` Docker image, and on Vercel's `@vercel/python` runtime (`backend/vercel.json`). No rewrite per environment. |
| **Reproducible for an examiner** | `requirements.txt` pins 30 exact versions; `python:3.12-slim` fixes the interpreter. |

---

## 2. Why FastAPI specifically — six benefits, honestly audited

| # | FastAPI benefit | What it means concretely | Did **your** code use it? |
|---|---|---|---|
| 1 | **ASGI + native `async`/`await`** | while one request waits on a third-party API, the worker serves others — no thread blocked on I/O | ⚠️ **Partly.** 2 of 10 handlers are `async`. `get_pasut` genuinely uses `httpx.AsyncClient`. But `trigger_weather_sync` is `async def` around **blocking** `httpx` + DB code → it stalls the event loop. Real benefit exists, execution is flawed. |
| 2 | **Automatic OpenAPI + interactive `/docs`** | every endpoint documents itself; you can demo the API live from the browser | ✅ **Yes** — `/docs` exposes all 10 endpoints. This is your most visible FastAPI win during a presentation. |
| 3 | **Validation via type hints** | `q: str = Query(max_length=100)` is validated and documented with zero extra code | ⚠️ **Barely.** Exactly **one** `Query(...)` exists. The capability is there; the codebase mostly doesn't declare constraints. |
| 4 | **Typed response schemas (Pydantic)** | `response_model=` validates output, documents fields, and prevents accidental leaks | ❌ **Not used.** Zero `BaseModel`, zero `response_model` → your `/docs` shows untyped blobs and your `/api/banjir` contract lives only in SQL strings. **This is the biggest gap and the easiest fix.** |
| 5 | **Middleware as one-liners** | CORS, gzip, auth, timing each become 3 lines | ✅ **Yes** — `CORSMiddleware` with an origin list + regex. (GZip is *not* added — a one-line, 3.2× payload win you can mention as future work.) |
| 6 | **Minimum boilerplate per endpoint** | 10 endpoints + a service layer in **346 lines**; Flask is comparable, Django would need much more | ✅ **Yes** — compare with what the same API costs in DRF. |
| 7 | **Pydantic v2 is Rust-backed** | validation is not the bottleneck even under load | ✅ Free property of the stack (pydantic-core 2.50.1 is installed). |

**How to present the partials without losing marks:** frame them as *"chosen for capability, partially exploited in a prototype, with the upgrade path identified"* — then name the fix. That reads as engineering maturity; claiming full async everywhere would collapse under one question about the cron handler.

### Your `async` scorecard (memorise)

```
10 handlers  →  2 async, 8 sync
  ✅ /api/maritim/pasut        async + httpx.AsyncClient  (correct)
  ❌ /api/cron/sync-weather    async def, but calls blocking httpx + SQLAlchemy inside
  8 × sync def                 → FastAPI runs these in a threadpool (safe, not scalable to 1000 rps)
DB layer       → synchronous psycopg; no asyncpg. Fine at 153 rows × few users.
```
The correct one-line fix for the cron endpoint: make it `def` (FastAPI will move it to the threadpool) or wrap the call in `run_in_threadpool` — either removes the event-loop stall.

---

## 3. Alternatives, and exactly why they lose *for this project*

| Option | Would have given you | Why it loses here |
|---|---|---|
| **Flask** | the same minimal single-file API; the most familiar framework for a lecturer | WSGI only (async is bolted on via extra packages), **no automatic OpenAPI docs**, no built-in validation. You would hand-write what FastAPI gives free, and lose the `/docs` demo. |
| **Django + DRF + GeoDjango** | the strongest *serious* alternative — GeoDjango has first-class PostGIS support, admin, auth, migrations, and drf-spectacular for docs | You would gain a migration system and an admin UI you don't use (the frontend is a separate React SPA; there is no server-rendered page except the dist fallback). Cost: settings/project scaffolding, ORM you deliberately avoided, heavier cold starts. **Mention this option first** — acknowledging it makes you look informed. |
| **Node.js / Fastify / Express** | one language for the whole stack, no context switch, huge ecosystem | **No GDAL-based geospatial stack.** Your import, raster and zonal-statistics steps would need GDAL CLI wrappers or a Python sidecar — i.e. you'd end up with two languages anyway, which is exactly what you avoided. (Note for honesty: `@turf/buffer` *would* have solved your canal-buffer code in three lines — JavaScript is fine for the client-side geometry you hand-rolled, just not for the data pipeline.) |
| **Go / Rust** | best raw throughput, tiny containers | weakest geospatial ecosystem, slowest development, hardest to hand an examiner a readable model file. Throughput was never the constraint (153 rows, a handful of concurrent users). |
| **Java / Spring Boot** | enterprise-grade, strong GIS via GeoTools | enormous boilerplate for 10 endpoints; GeoTools is notoriously heavy; no benefit at this scale. |
| **Supabase Edge Functions / PostgREST** | zero backend code | your risk model, batching, external API proxying and payload transformation would all have to move into the database or the browser. You'd lose the testable pure-function model. |

**The honest concession to make:** *"Node would have been more natural if the frontend had been the whole project. It isn't — two thirds of the engineering is data preparation, and that is Python territory."*

---

## 4. The cost side (volunteer this — examiners reward it)

| Cost of Python/FastAPI | Consequence in this project | Mitigation / answer |
|---|---|---|
| Slowest cold starts of the mainstream runtimes | Vercel serverless first request after idle is slower; the 4-call daily ETL risks a timeout | keep the ETL chunked or move it to a worker; a warm instance is fine for normal traffic |
| Heavy native dependencies | `geopandas`/`rasterio` require GDAL wheels; your `requirements.txt` **omits** geopandas/pandas/numpy/shapely entirely, so the ETL only runs from the committed venv | split `requirements.txt` (runtime) from `requirements-etl.txt`; never commit a venv (9179 files — see the audit) |
| GIL | irrelevant here — the workload is I/O-bound, not CPU-bound | say exactly that; it shows you know when the GIL matters |
| Dynamic typing → runtime surprises | score outside 1–5 would silently produce nonsense — which is why `calculate_risk()` raises `ValueError` explicitly | type hints + Pydantic response models are the systematic fix |
| Async is easy to get wrong | your cron handler is the textbook mistake (async def + blocking I/O) | make it `def`, or adopt `asyncpg` for a fully async path |
| Dependency sprawl | 30 pinned packages for 10 endpoints; `apscheduler` and `GeoAlchemy2` are imported **nowhere** | prune unused deps in the next pass |

---

## 5. Prepared Q&A (this topic only)

1. **"Why Python?"** → "Because the project is 2/3 geospatial data engineering: geometry repair, reprojection, DEM sampling and zonal statistics. That toolchain — GeoPandas, Shapely, Rasterio, Rasterstats on top of GDAL — has no mature Node equivalent. One language for the ETL, the API and the risk model also means the model is importable by both the cron job and the request handler."
2. **"Why not Flask?"** → "I'd have hand-written the OpenAPI schema, the request validation and the CORS plumbing. FastAPI gives all three from type hints, and `/docs` is directly useful in a defence — you can call the API in front of the examiner."
3. **"Why not Django?"** → "GeoDjango is the strongest alternative and I considered it. But I have no server-rendered pages, no auth and no admin in scope; Django would have added a project layout, migrations and an ORM I deliberately avoided, for 10 endpoints."
4. **"You used FastAPI but you're not async — did you get the benefit?"** → "Partially, and I can point at both cases: `/api/maritim/pasut` awaits `httpx.AsyncClient`, so it releases the worker while waiting on Open-Meteo; the cron handler is `async def` around blocking code, which is the anti-pattern — the fix is one keyword. Eight handlers are sync `def`, which FastAPI safely runs in a threadpool; at 153 rows and this traffic, that is the right trade."
5. **"Is FastAPI faster than Flask?"** → "On a trivial benchmark yes, because Starlette is ASGI and the server is uvicorn rather than a WSGI container — but that is not why I chose it. My bottleneck is a 780 KB GeoJSON payload and third-party latency, not request routing. I'd rather be honest: the performance argument for FastAPI is secondary to the documentation and validation argument."
6. **"Would you choose it again?"** → "Yes, with four upgrades that would make the choice defensible rather than merely convenient: (1) `response_model=` on every endpoint so the OpenAPI schema is real, (2) `def` for the cron handler or `asyncpg` for a fully async data path, (3) `GZipMiddleware` + cache headers, (4) split the ETL requirements and drop the unused dependencies."
7. **"Why not just do everything in the browser?"** → "Three reasons: the database is PostGIS and the browser shouldn't hold credentials; Open-Meteo would be called from each client, multiplying latency and rate-limit exposure; and geometry repair plus raster sampling cannot run in a browser at all."

---

## 6. One-slide version (paste this into the deck)

> **Stack justification**
> - **Python** because the pipeline is geospatial engineering: GeoPandas + Shapely + Rasterio + Rasterstats on GDAL give geometry repair, reprojection, DEM sampling and zonal statistics out of the box — no comparable Node stack exists. One language for ETL, API and the risk model; the model module is imported by both the cron job and the request handler.
> - **FastAPI** because 10 endpoints cost **346 lines**, ship with **auto-generated OpenAPI at `/docs`**, declarative validation from type hints, one-line CORS middleware, native `async` for the Open-Meteo calls, and deploy unchanged to uvicorn, Docker or Vercel.
> - **Trade-offs accepted:** slower cold starts, heavy native deps (GDAL), and async is only partly exploited — 2 of 10 handlers are `async`, one of them incorrectly. Response models and gzip are identified as the next two one-day improvements.

**If you only remember one sentence:** *"The choice was driven by the data pipeline, not by the web framework — and the framework was picked because it documents and validates itself for free."*
