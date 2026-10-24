-- Parameter statis per kelurahan untuk model overlay Nurliah et al. (2025).
-- Nilai 1-5 harus diisi dari overlay layer penggunaan lahan, jenis tanah,
-- jarak sungai, dan kemiringan lereng Copernicus. Jangan mengisi dengan asumsi.
CREATE TABLE IF NOT EXISTS public.parameter_kerawanan_kelurahan (
    kelurahan_id INTEGER PRIMARY KEY REFERENCES public.kelurahan(id) ON DELETE CASCADE,
    skor_penggunaan_lahan SMALLINT NOT NULL CHECK (skor_penggunaan_lahan BETWEEN 1 AND 5),
    skor_jenis_tanah SMALLINT NOT NULL CHECK (skor_jenis_tanah BETWEEN 1 AND 5),
    skor_jarak_sungai SMALLINT NOT NULL CHECK (skor_jarak_sungai BETWEEN 1 AND 5),
    skor_kemiringan_lereng SMALLINT NOT NULL CHECK (skor_kemiringan_lereng BETWEEN 1 AND 5),
    sumber_penggunaan_lahan TEXT NOT NULL,
    sumber_jenis_tanah TEXT NOT NULL,
    sumber_jarak_sungai TEXT NOT NULL,
    sumber_kemiringan_lereng TEXT NOT NULL DEFAULT 'Copernicus DEM',
    diperbarui_pada TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.potensi_banjir
    ADD COLUMN IF NOT EXISTS indeks_kerawanan NUMERIC(6,2),
    ADD COLUMN IF NOT EXISTS estimasi_kedalaman_cm NUMERIC(6,2),
    ADD COLUMN IF NOT EXISTS kondisi_bmkg TEXT,
    ADD COLUMN IF NOT EXISTS sumber_model TEXT;
