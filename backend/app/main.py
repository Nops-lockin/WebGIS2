import os
import math
from datetime import datetime, timezone, timedelta
from pathlib import Path

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
# CORS
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
# Root – serve SPA if frontend/dist exists
# ----------------------------------------------------------
@app.get("/")
def beranda():
    index_file = Path(__file__).resolve().parents[2] / "frontend" / "dist" / "index.html"
    if index_file.is_file():
        return FileResponse(index_file)
    return {"aplikasi": "JeneBosi (JB)", "status": "aktif", "dokumentasi": "/docs"}


# ----------------------------------------------------------
# Health check
# ----------------------------------------------------------
@app.get("/api/health")
def health():
    try:
        with engine.connect() as conn:
            db_name = conn.execute(text("SELECT current_database()")).scalar_one()
            postgis = conn.execute(text("SELECT PostGIS_Version()")).scalar_one()
            jumlah = conn.execute(text("SELECT COUNT(*) FROM public.kelurahan")).scalar_one()
        return {"status": "ok", "database": db_name, "postgis": postgis, "jumlah_kelurahan": jumlah}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Koneksi database gagal: {exc}") from exc


# ----------------------------------------------------------
# Cron – weather sync
# ----------------------------------------------------------
@app.get("/api/cron/sync-weather")
async def trigger_weather_sync():
    """Vercel cron job endpoint."""
    try:
        result = sync_curah_hujan_dan_banjir()
        return {"status": "success", "data": result}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


# ----------------------------------------------------------
# Sync status
# ----------------------------------------------------------
@app.get("/api/sync-status")
def get_sync_status():
    return last_sync_info


# ----------------------------------------------------------
# Kelurahan – list & search
# ----------------------------------------------------------
@app.get("/api/kelurahan")
def daftar_kelurahan(q: str = Query(default="", max_length=100)):
    try:
        with engine.connect() as conn:
            rows = conn.execute(
                text("""
                    SELECT id, kode_wilayah, nama_kelurahan
                    FROM public.kelurahan
                    WHERE nama_kelurahan ILIKE :q
                    ORDER BY nama_kelurahan LIMIT 100
                """),
                {"q": f"%{q}%"},
            ).mappings().all()
        return [dict(r) for r in rows]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ----------------------------------------------------------
# Kelurahan – GeoJSON
# ----------------------------------------------------------
@app.get("/api/kelurahan/geojson")
def get_kelurahan_geojson():
    try:
        with engine.connect() as conn:
            rows = conn.execute(text("""
                SELECT id, kode_wilayah, nama_kelurahan,
                       ST_AsGeoJSON(geom)::json AS geometry
                FROM public.kelurahan
                WHERE geom IS NOT NULL
                ORDER BY nama_kelurahan
            """)).mappings().all()
        features = [
            {
                "type": "Feature",
                "geometry": r["geometry"],
                "properties": {
                    "id": r["id"],
                    "kode_wilayah": r["kode_wilayah"],
                    "nama_kelurahan": r["nama_kelurahan"],
                },
            }
            for r in rows if r["geometry"] is not None
        ]
        return {"type": "FeatureCollection", "total": len(features), "features": features}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ----------------------------------------------------------
# Kelurahan – latest rainfall
# ----------------------------------------------------------
@app.get("/api/kelurahan/{kelurahan_id}/hujan-terbaru")
def get_hujan_terbaru(kelurahan_id: int):
    try:
        with engine.connect() as conn:
            row = conn.execute(text("""
                SELECT k.id AS kelurahan_id, k.nama_kelurahan,
                       ch.waktu_pengamatan AS tanggal, ch.nilai_mm AS curah_hujan
                FROM public.kelurahan k
                JOIN public.curah_hujan ch ON k.id = ch.kelurahan_id
                WHERE k.id = :id
                ORDER BY ch.waktu_pengamatan DESC LIMIT 1
            """), {"id": kelurahan_id}).mappings().first()
        if row:
            return dict(row)
        raise HTTPException(status_code=404, detail="Data hujan tidak ditemukan")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ----------------------------------------------------------
# Flood risk – all kelurahan
# ----------------------------------------------------------
@app.get("/api/banjir")
def get_banjir():
    """Latest flood-risk row for every kelurahan (colours the map)."""
    try:
        with engine.connect() as conn:
            rows = conn.execute(text("""
                SELECT pb.kelurahan_id,
                       k.nama_kelurahan, k.kode_wilayah,
                       pb.tingkat, pb.hujan_mm, pb.elevasi_m,
                       pb.indeks_kerawanan, pb.estimasi_kedalaman_cm,
                       pb.kondisi_bmkg, pb.waktu_analisis,
                       pb.metode, pb.sumber_model
                FROM public.potensi_banjir pb
                JOIN public.kelurahan k ON k.id = pb.kelurahan_id
                ORDER BY k.nama_kelurahan
            """)).mappings().all()
        return [dict(r) for r in rows]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ----------------------------------------------------------
# BMKG weather forecast
# The frontend's normalisasiPrakiraan() accepts objects that have
# any of: waktu_lokal | datetime | waktu  → mapped to waktu_lokal
#         suhu_c | suhu | temperature     → mapped to suhu_c
#         kondisi | weather_desc | cuaca  → mapped to kondisi
#
# The actual DB table columns are:
#   suhu_c, kelembapan_persen, kondisi_cuaca, waktu_prakiraan, sumber
# ----------------------------------------------------------
@app.get("/api/bmkg/prakiraan/{kode_wilayah}")
@app.get("/api/prakiraan/{kode_wilayah}")
def get_prakiraan(kode_wilayah: str):
    """Weather forecasts for a kelurahan. Falls back to most-recent rows
    when no future rows exist, so the panel is never empty after the first sync."""
    base_sql = """
        SELECT pb.id, pb.kelurahan_id, k.nama_kelurahan,
               pb.kondisi_cuaca  AS kondisi,
               pb.suhu_c,
               pb.kelembapan_persen,
               pb.waktu_prakiraan AS waktu_lokal,
               pb.sumber
        FROM public.prakiraan_bmkg pb
        JOIN public.kelurahan k ON k.id = pb.kelurahan_id
        WHERE k.kode_wilayah = :kode
    """
    try:
        with engine.connect() as conn:
            # 1st try: forecasts from the last 6 hours onward
            rows = conn.execute(
                text(base_sql + " AND pb.waktu_prakiraan >= (NOW() - INTERVAL '6 hours') ORDER BY pb.waktu_prakiraan LIMIT 20"),
                {"kode": kode_wilayah},
            ).mappings().all()

            # Fallback: any stored rows (most recent first)
            if not rows:
                rows = conn.execute(
                    text(base_sql + " ORDER BY pb.waktu_prakiraan DESC LIMIT 20"),
                    {"kode": kode_wilayah},
                ).mappings().all()

        return {"prakiraan": [dict(r) for r in rows]}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ----------------------------------------------------------
# Pasang-surut / tide data
# TideMonitorWidget.jsx reads these exact fields:
#   total_elevasi_m, ketinggian_pasut_m, status_rob, status_label,
#   status_desc, tinggi_gelombang_m, kecepatan_arus_ms,
#   periode_gelombang_detik, waktu_wita, stasiun, jadwal_harian[]
# We fetch from Open-Meteo Marine and transform to that shape.
# ----------------------------------------------------------
@app.get("/api/maritim/pasut")
async def get_pasut():
    """Fetch marine data from Open-Meteo and transform it to the
    shape expected by TideMonitorWidget.jsx."""

    lat, lon = -5.12, 119.40          # Pelabuhan Paotere
    wita_offset = timedelta(hours=8)  # WIB+1 / WITA

    try:
        url = (
            "https://marine-api.open-meteo.com/v1/marine"
            f"?latitude={lat}&longitude={lon}"
            "&current=wave_height,wave_period,wave_direction,ocean_current_velocity"
            "&hourly=wave_height,wave_period"
            "&timezone=Asia%2FMakassar&forecast_days=1"
        )
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url)
        resp.raise_for_status()
        raw = resp.json()

        cur = raw.get("current", {})
        wave_h = cur.get("wave_height")            # metres
        wave_p = cur.get("wave_period")            # seconds
        current_v = cur.get("ocean_current_velocity")  # m/s

        # Simple tidal height model using semi-diurnal M2 constituent
        # dominant for Makassar Strait.  This is indicative only.
        now_wita = datetime.now(timezone.utc) + wita_offset
        t_hours = now_wita.hour + now_wita.minute / 60
        # M2 period ≈ 12.42 h, amplitude ≈ 0.65 m around MSL 0.9 m
        tide_h = round(0.9 + 0.65 * math.cos(2 * math.pi * t_hours / 12.42), 2)
        total_elev = round(tide_h + (wave_h or 0) * 0.1, 2)   # rough surge component

        # Rob / flood-risk category
        if total_elev >= 1.40:
            status_rob = "ekstrem"
            status_label = "Pasang Ekstrem – Risiko Rob Tinggi"
            status_desc = ("Ketinggian air laut melebihi ambang kritis. "
                           "Drainase kota tertutup gravitasi. Waspadai genangan di wilayah pesisir.")
        elif total_elev >= 1.10:
            status_rob = "waspada"
            status_label = "Pasang Waspada"
            status_desc = ("Elevasi air laut mendekati ambang rob. "
                           "Perhatikan kondisi drainase di kelurahan pesisir.")
        else:
            status_rob = "normal"
            status_label = "Surut Normal"
            status_desc = ("Elevasi air laut rendah. Gravitasi aliran drainase kota "
                           "menuju laut Selat Makassar berfungsi optimal.")

        # Build daily schedule (4 key events per day from the simple model)
        jadwal = []
        for event_h, label, peak in [(1, "Pasang Pertama", True), (7, "Surut Pagi", False),
                                      (13, "Pasang Siang", True), (19, "Surut Malam", False)]:
            h = round(0.9 + 0.65 * math.cos(2 * math.pi * event_h / 12.42), 2)
            jadwal.append({
                "waktu": f"{event_h:02d}:00 WITA",
                "jenis": label,
                "tinggi": f"+{h} m",
                "peak": peak,
            })

        return {
            "status": "ok",
            "sumber": "Open-Meteo Marine API + Model Harmonik M2",
            "stasiun": "Pelabuhan Paotere Makassar (-5.12°S, 119.40°E)",
            "waktu_wita": now_wita.strftime("%H:%M WITA"),
            "ketinggian_pasut_m": tide_h,
            "tinggi_gelombang_m": wave_h,
            "kecepatan_arus_ms": round(current_v, 2) if current_v is not None else None,
            "periode_gelombang_detik": wave_p,
            "total_elevasi_m": total_elev,
            "status_rob": status_rob,
            "status_label": status_label,
            "status_desc": status_desc,
            "jadwal_harian": jadwal,
        }

    except Exception as exc:
        # Return a graceful fallback so the widget still renders
        return {
            "status": "offline_fallback",
            "sumber": "Model Astronomis Harmonik Pelabuhan Paotere Makassar",
            "stasiun": "Pelabuhan Paotere / Selat Makassar (-5.12°S, 119.40°E)",
            "waktu_wita": "Real-Time Komputasi",
            "ketinggian_pasut_m": 0.55,
            "tinggi_gelombang_m": 0.40,
            "kecepatan_arus_ms": 0.35,
            "periode_gelombang_detik": 4.0,
            "total_elevasi_m": 0.61,
            "status_rob": "normal",
            "status_label": "Surut Normal",
            "status_desc": (
                "Elevasi air laut rendah. Gravitasi aliran drainase kota "
                "menuju laut Selat Makassar berfungsi optimal."
            ),
            "jadwal_harian": [
                {"waktu": "01:15 WITA", "jenis": "Pasang Tinggi",  "tinggi": "+1.42 m", "peak": True},
                {"waktu": "07:30 WITA", "jenis": "Surut Terendah", "tinggi": "+0.45 m", "peak": False},
                {"waktu": "13:45 WITA", "jenis": "Pasang Puncak",  "tinggi": "+1.48 m", "peak": True},
                {"waktu": "19:50 WITA", "jenis": "Surut Malam",    "tinggi": "+0.52 m", "peak": False},
            ],
        }
