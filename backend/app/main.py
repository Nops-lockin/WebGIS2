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

# Serve static assets from the built frontend
app.mount(
    "/static",
    StaticFiles(directory=Path(__file__).resolve().parents[2] / "frontend" / "dist", html=True),
    name="static",
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
                "properties": {"id": row["id"], "kode_wilayah": row["kode_wilayah"], "nama_kelurahan": row["nama_kelurahan"]},
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
        SELECT k.id AS kelurahan_id, k.nama_kelurahan, r.tanggal, r.curah_hujan
        FROM public.kelurahan k
        JOIN public.curah_hujan r ON k.id = r.kelurahan_id
        WHERE k.id = :kelurahan_id
        ORDER BY r.tanggal DESC
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
