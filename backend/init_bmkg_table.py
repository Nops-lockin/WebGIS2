from app.database import engine
from sqlalchemy import text

def init_tables():
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS public.prakiraan_bmkg (
                id SERIAL PRIMARY KEY,
                kelurahan_id INTEGER REFERENCES public.kelurahan(id) ON DELETE CASCADE,
                kode_wilayah VARCHAR(50),
                waktu_prakiraan TIMESTAMPTZ,
                suhu_c NUMERIC(5,2),
                kelembapan_persen NUMERIC(5,2),
                kondisi_cuaca TEXT,
                sumber TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_bmkg_kelurahan_waktu ON public.prakiraan_bmkg(kelurahan_id, waktu_prakiraan);
        """))
    print("Table prakiraan_bmkg created successfully.")

if __name__ == "__main__":
    init_tables()
