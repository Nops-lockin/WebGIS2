import os
from pathlib import Path
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
import httpx

from app.database import engine
from app.services.rain_sync import sync_curah_hujan_dan_banjir, last_sync_info

app = FastAPI(
    title="JeneBosi (JB)",
    description="JeneBosi (JB): WebGIS potensi banjir dan rute evakuasi Kota Makassar",
    version="1.3.0",
)

# ----------------------------------------------------------
# 0. CORS configuration
# ----------------------------------------------------------
allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----------------------------------------------------------
# 1. Root endpoint – serve the SPA index.html
# ----------------------------------------------------------
@app.get("/")
def beranda():
    index_file = Path(__file__).resolve().parents[2] / "frontend" / "dist" / "index.html"
    if index_file.is_file():
        return FileResponse(index_file)
    return {"aplikasi": "JeneBosi (JB)", "status": "aktif", "dokumentasi": "/docs"}


# ----------------------------------------------------------
# 2. Health check
# ----------------------------------------------------------
@app.get("/api/health")
def health():
    try:
        with engine.connect() as conn:
            db_name = conn.execute(text("SELECT current_database()")).scalar_one()
            postgis = conn.execute(text("SELECT PostGIS_Version()")).scalar_one()
            jumlah_kelurahan = conn.execute(text("SELECT COUNT(*) FROM public.kelurahan")).scalar_one()
        return {"status": "ok", "database": db_name, "postgis": postgis, "jumlah_kelurahan": jumlah_kelurahan}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Koneksi database gagal: {str(exc)}") from exc


# ----------------------------------------------------------
# 3. Cron endpoint for weather sync
# ----------------------------------------------------------
@app.get("/api/cron/sync-weather")
async def trigger_weather_sync():
    """Endpoint for Vercel cron job to synchronize weather forecast & flood risk."""
    try:
        result = sync_curah_hujan_dan_banjir()
        return {"status": "success", "data": result}
    except Exception as e:
        return {"status": "error", "message": str(e)}


# ----------------------------------------------------------
# 4. Kelurahan list & search
# ----------------------------------------------------------
@app.get("/api/kelurahan")
def daftar_kelurahan(q: str = Query(default="", max_length=100)):
    try:
        with engine.connect() as conn:
            rows = conn.execute(
                text(
                    """
                    SELECT id, kode_wilayah, nama_kelurahan
                    FROM public.kelurahan
                    WHERE nama_kelurahan ILIKE :q
                    ORDER BY nama_kelurahan
                    LIMIT 100
                    """
                ),
                {"q": f"%{q}%"},
            ).mappings().all()
        return [dict(row) for row in rows]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Gagal mengambil data kelurahan: {str(exc)}") from exc


# ----------------------------------------------------------
# 5. Kelurahan GeoJSON
# ----------------------------------------------------------
@app.get("/api/kelurahan/geojson")
def get_kelurahan_geojson():
    query = text(
        """
        SELECT id, kode_wilayah, nama_kelurahan, ST_AsGeoJSON(geom)::json AS geometry
        FROM public.kelurahan
        WHERE geom IS NOT NULL
        ORDER BY nama_kelurahan
        """
    )
    try:
        with engine.connect() as conn:
            rows = conn.execute(query).mappings().all()
        features = []
        for row in rows:
            if row["geometry"] is None:
                continue
            features.append({
                "type": "Feature",
                "geometry": row["geometry"],
                "properties": {
                    "id": row["id"],
                    "kode_wilayah": row["kode_wilayah"],
                    "nama_kelurahan": row["nama_kelurahan"],
                },
            })
        return {"type": "FeatureCollection", "total": len(features), "features": features}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Gagal mengambil GeoJSON kelurahan: {str(exc)}") from exc


# ----------------------------------------------------------
# 6. Latest rainfall for a kelurahan
# ----------------------------------------------------------
@app.get("/api/kelurahan/{kelurahan_id}/hujan-terbaru")
def get_hujan_terbaru(kelurahan_id: int):
    query = text(
        """
        SELECT k.id AS kelurahan_id, k.nama_kelurahan,
               ch.waktu_pengamatan AS tanggal, ch.nilai_mm AS curah_hujan
        FROM public.kelurahan k
        JOIN public.curah_hujan ch ON k.id = ch.kelurahan_id
        WHERE k.id = :kelurahan_id
        ORDER BY ch.waktu_pengamatan DESC
        LIMIT 1
        """
    )
    try:
        with engine.connect() as conn:
            row = conn.execute(query, {"kelurahan_id": kelurahan_id}).mappings().first()
        if row:
            return dict(row)
        raise HTTPException(status_code=404, detail="Data hujan tidak ditemukan")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Gagal mengambil data hujan: {str(exc)}") from exc


# ==========================================================
# 7. FLOOD RISK DATA (potensi_banjir) — REQUIRED BY FRONTEND
# ==========================================================
# The frontend (App.jsx) fetches /api/banjir on mount and uses
# it to colour every kelurahan polygon and populate risk counts.
# ----------------------------------------------------------
@app.get("/api/banjir")
def get_banjir():
    """Return the latest flood-risk row for every kelurahan."""
    query = text(
        """
        SELECT
            pb.kelurahan_id,
            k.nama_kelurahan,
            k.kode_wilayah,
            pb.tingkat,
            pb.hujan_mm,
            pb.elevasi_m,
            pb.indeks_kerawanan,
            pb.estimasi_kedalaman_cm,
            pb.kondisi_bmkg,
            pb.waktu_analisis,
            pb.metode,
            pb.sumber_model
        FROM public.potensi_banjir pb
        JOIN public.kelurahan k ON k.id = pb.kelurahan_id
        ORDER BY k.nama_kelurahan
        """
    )
    try:
        with engine.connect() as conn:
            rows = conn.execute(query).mappings().all()
        return [dict(r) for r in rows]
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Gagal mengambil data potensi banjir: {str(exc)}",
        ) from exc


# ==========================================================
# 8. BMKG WEATHER FORECAST — REQUIRED BY FRONTEND
# ==========================================================
# The frontend tries /api/bmkg/prakiraan/{kode_wilayah} first,
# then falls back to /api/prakiraan/{kode_wilayah}.
# The frontend's normalisasiPrakiraan() expects objects with:
#   waktu_lokal | datetime | waktu, suhu_c | suhu, kelembapan_persen,
#   kondisi | weather_desc | cuaca
# ----------------------------------------------------------
@app.get("/api/bmkg/prakiraan/{kode_wilayah}")
@app.get("/api/prakiraan/{kode_wilayah}")
def get_prakiraan(kode_wilayah: str):
    """Return BMKG weather forecasts for a kelurahan by kode_wilayah."""
    # First try: future forecasts
    # Fallback: most recent forecasts (even if in the past) so the panel
    # is never empty as long as any data has been synced at least once.
    query_future = text(
        """
        SELECT
            pb.id,
            pb.kelurahan_id,
            k.nama_kelurahan,
            pb.kondisi_cuaca  AS kondisi,
            pb.suhu_c,
            pb.kelembapan_persen,
            pb.waktu_prakiraan AS waktu_lokal,
            pb.sumber
        FROM public.prakiraan_bmkg pb
        JOIN public.kelurahan k ON k.id = pb.kelurahan_id
        WHERE k.kode_wilayah = :kode_wilayah
          AND pb.waktu_prakiraan >= (NOW() - INTERVAL '6 hours')
        ORDER BY pb.waktu_prakiraan
        LIMIT 20
        """
    )
    query_latest = text(
        """
        SELECT
            pb.id,
            pb.kelurahan_id,
            k.nama_kelurahan,
            pb.kondisi_cuaca  AS kondisi,
            pb.suhu_c,
            pb.kelembapan_persen,
            pb.waktu_prakiraan AS waktu_lokal,
            pb.sumber
        FROM public.prakiraan_bmkg pb
        JOIN public.kelurahan k ON k.id = pb.kelurahan_id
        WHERE k.kode_wilayah = :kode_wilayah
        ORDER BY pb.waktu_prakiraan DESC
        LIMIT 20
        """
    )
    try:
        with engine.connect() as conn:
            rows = conn.execute(query_future, {"kode_wilayah": kode_wilayah}).mappings().all()
            if not rows:
                rows = conn.execute(query_latest, {"kode_wilayah": kode_wilayah}).mappings().all()
        prakiraan = [dict(r) for r in rows]
        return {"prakiraan": prakiraan}
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Gagal mengambil prakiraan BMKG: {str(exc)}",
        ) from exc


# ==========================================================
# 9. TIDE / PASANG-SURUT DATA — REQUIRED BY FRONTEND
# ==========================================================
# TideMonitorWidget.jsx fetches /api/maritim/pasut
# ----------------------------------------------------------
@app.get("/api/maritim/pasut")
async def get_pasut():
    """
    Proxy tidal data from Open-Meteo Marine API for Makassar Strait.
    Returns sea-level and wave data so the frontend TideMonitorWidget
    can display current conditions.  Falls back to an empty response
    if the external API is unreachable.
    """
    # Makassar Strait approximate coordinates
    lat, lon = -5.15, 119.43
    url = (
        f"https://marine-api.open-meteo.com/v1/marine"
        f"?latitude={lat}&longitude={lon}"
        f"&current=wave_height,wave_period,wave_direction"
        f"&hourly=wave_height,wave_period,wave_direction"
        f"&timezone=Asia%2FMakassar"
        f"&forecast_days=1"
    )
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url)
        if resp.status_code != 200:
            return {"status": "error", "message": f"Open-Meteo HTTP {resp.status_code}", "data": []}
        data = resp.json()
        return {"status": "ok", "data": data}
    except Exception as exc:
        return {"status": "error", "message": str(exc), "data": []}


# ==========================================================
# 10. SYNC STATUS
# ==========================================================
@app.get("/api/sync-status")
def get_sync_status():
    """Return the status of the last rain/flood sync run."""
    return last_sync_info


# ==========================================================
# 7. FLOOD RISK DATA (potensi_banjir) — REQUIRED BY FRONTEND
# ==========================================================
# The frontend (App.jsx) fetches /api/banjir on mount and uses
# it to colour every kelurahan polygon and populate risk counts.
# ----------------------------------------------------------
@app.get("/api/banjir")
def get_banjir():
    """Return the latest flood-risk row for every kelurahan."""
    query = text(
        """
        SELECT
            pb.kelurahan_id,
            k.nama_kelurahan,
            k.kode_wilayah,
            pb.tingkat,
            pb.hujan_mm,
            pb.elevasi_m,
            pb.indeks_kerawanan,
            pb.estimasi_kedalaman_cm,
            pb.kondisi_bmkg,
            pb.waktu_analisis,
            pb.metode,
            pb.sumber_model
        FROM public.potensi_banjir pb
        JOIN public.kelurahan k ON k.id = pb.kelurahan_id
        ORDER BY k.nama_kelurahan
        """
    )
    try:
        with engine.connect() as conn:
            rows = conn.execute(query).mappings().all()
        return [dict(r) for r in rows]
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Gagal mengambil data potensi banjir: {str(exc)}",
        ) from exc


# ==========================================================
# 8. BMKG WEATHER FORECAST — REQUIRED BY FRONTEND
# ==========================================================
# The frontend tries /api/bmkg/prakiraan/{kode_wilayah} first,
# then falls back to /api/prakiraan/{kode_wilayah}.
# The frontend's normalisasiPrakiraan() expects objects with:
#   waktu_lokal | datetime | waktu, suhu_c | suhu, kelembapan_persen,
#   kondisi | weather_desc | cuaca
# ----------------------------------------------------------
@app.get("/api/bmkg/prakiraan/{kode_wilayah}")
@app.get("/api/prakiraan/{kode_wilayah}")
def get_prakiraan(kode_wilayah: str):
    """Return BMKG weather forecasts for a kelurahan by kode_wilayah."""
    # First try: future forecasts
    # Fallback: most recent forecasts (even if in the past) so the panel
    # is never empty as long as any data has been synced at least once.
    query_future = text(
        """
        SELECT
            pb.id,
            pb.kelurahan_id,
            k.nama_kelurahan,
            pb.kondisi_cuaca  AS kondisi,
            pb.suhu_c,
            pb.kelembapan_persen,
            pb.waktu_prakiraan AS waktu_lokal,
            pb.sumber
        FROM public.prakiraan_bmkg pb
        JOIN public.kelurahan k ON k.id = pb.kelurahan_id
        WHERE k.kode_wilayah = :kode_wilayah
          AND pb.waktu_prakiraan >= (NOW() - INTERVAL '6 hours')
        ORDER BY pb.waktu_prakiraan
        LIMIT 20
        """
    )
    query_latest = text(
        """
        SELECT
            pb.id,
            pb.kelurahan_id,
            k.nama_kelurahan,
            pb.kondisi_cuaca  AS kondisi,
            pb.suhu_c,
            pb.kelembapan_persen,
            pb.waktu_prakiraan AS waktu_lokal,
            pb.sumber
        FROM public.prakiraan_bmkg pb
        JOIN public.kelurahan k ON k.id = pb.kelurahan_id
        WHERE k.kode_wilayah = :kode_wilayah
        ORDER BY pb.waktu_prakiraan DESC
        LIMIT 20
        """
    )
    try:
        with engine.connect() as conn:
            rows = conn.execute(query_future, {"kode_wilayah": kode_wilayah}).mappings().all()
            if not rows:
                rows = conn.execute(query_latest, {"kode_wilayah": kode_wilayah}).mappings().all()
        prakiraan = [dict(r) for r in rows]
        return {"prakiraan": prakiraan}
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Gagal mengambil prakiraan BMKG: {str(exc)}",
        ) from exc


# ==========================================================
# 9. TIDE / PASANG-SURUT DATA — REQUIRED BY FRONTEND
# ==========================================================
# TideMonitorWidget.jsx fetches /api/maritim/pasut
# ----------------------------------------------------------
@app.get("/api/maritim/pasut")
async def get_pasut():
    """
    Proxy tidal data from Open-Meteo Marine API for Makassar Strait.
    Returns sea-level and wave data so the frontend TideMonitorWidget
    can display current conditions.  Falls back to an empty response
    if the external API is unreachable.
    """
    # Makassar Strait approximate coordinates
    lat, lon = -5.15, 119.43
    url = (
        f"https://marine-api.open-meteo.com/v1/marine"
        f"?latitude={lat}&longitude={lon}"
        f"&current=wave_height,wave_period,wave_direction"
        f"&hourly=wave_height,wave_period,wave_direction"
        f"&timezone=Asia%2FMakassar"
        f"&forecast_days=1"
    )
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url)
        if resp.status_code != 200:
            return {"status": "error", "message": f"Open-Meteo HTTP {resp.status_code}", "data": []}
        data = resp.json()
        return {"status": "ok", "data": data}
    except Exception as exc:
        return {"status": "error", "message": str(exc), "data": []}


# ==========================================================
# 10. SYNC STATUS
# ==========================================================
@app.get("/api/sync-status")
def get_sync_status():
    """Return the status of the last rain/flood sync run."""
    return last_sync_info

