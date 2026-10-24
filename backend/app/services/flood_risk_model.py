"""Model kerawanan banjir berbobot, diadaptasi dari Nurliah et al. (2025)."""

WEIGHTS = {
    "penggunaan_lahan": 35,
    "curah_hujan": 25,
    "jarak_sungai": 20,
    "jenis_tanah": 10,
    "kemiringan_lereng": 10,
}


def rain_score_from_bmkg(condition: str | None) -> int:
    """Mengubah kategori prakiraan BMKG menjadi skor 1-5; bukan mm observasi."""
    value = (condition or "").lower()
    if any(word in value for word in ("ekstrem", "petir", "lebat")):
        return 5
    if "hujan" in value:
        return 4
    if any(word in value for word in ("berawan", "kabut")):
        return 2
    return 1


def calculate_risk(*, land_use_score: int, soil_score: int, river_distance_score: int,
                   slope_score: int, weather_condition: str | None) -> dict:
    """Menghasilkan indeks 100-500, kategori risiko, dan estimasi kedalaman indikatif."""
    scores = {
        "penggunaan_lahan": int(land_use_score),
        "jenis_tanah": int(soil_score),
        "jarak_sungai": int(river_distance_score),
        "kemiringan_lereng": int(slope_score),
        "curah_hujan": rain_score_from_bmkg(weather_condition),
    }
    if any(score < 1 or score > 5 for score in scores.values()):
        raise ValueError("Setiap skor parameter harus bernilai 1 sampai 5.")

    index = sum(scores[name] * WEIGHTS[name] for name in WEIGHTS)
    if index <= 230:
        level = "Rendah"
    elif index <= 330:
        level = "Sedang"
    elif index <= 430:
        level = "Tinggi"
    else:
        level = "Sangat Tinggi"

    # Indikator komunikasi publik, bukan keluaran hidrodinamika/sensor.
    depth_cm = max(0, min(120, round(((index - 100) / 400) * 120 / 5) * 5))
    return {"index": index, "level": level, "depth_cm": depth_cm, "scores": scores}
