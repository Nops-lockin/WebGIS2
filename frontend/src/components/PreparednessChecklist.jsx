import React, { useState, useEffect } from "react";
import { IconCheck, IconShield, IconPhone, IconAlertTriangle } from "../Icons";

const DEFAULT_CHECKLIST = [
  // Kategori 1: Pra-Bencana (Kesiapsiagaan Sebelum Banjir)
  {
    id: "pre-1",
    category: "pra",
    title: "Simpan Nomor Kontak Darurat di Ponsel",
    desc: "Catat nomor penting: Call Center Makassar 112, BPBD Makassar (0411-444444), SAR (115), PLN (123).",
  },
  {
    id: "pre-2",
    category: "pra",
    title: "Amankan Dokumen Penting dalam Tas Kedap Air",
    desc: "Bungkus Ijazah, KTP, KK, Akta Lahir, Sertifikat, dan Buku Nikah dalam kantong ziplock tahan air di lantai atas/lemari tinggi.",
  },
  {
    id: "pre-3",
    category: "pra",
    title: "Siapkan Tas Siaga Bencana (TSB) Keluarga",
    desc: "Isi dengan pakaian ganti 3 hari, senter kedap air, baterai cadangan, peluit tanda bahaya, dan obat-obatan pribadi.",
  },
  {
    id: "pre-4",
    category: "pra",
    title: "Isi Penuh Daya Ponsel & Power Bank",
    desc: "Pastikan seluruh perangkat komunikasi terisi penuh saat BMKG mengeluarkan peringatan dini hujan lebat.",
  },
  {
    id: "pre-5",
    category: "pra",
    title: "Cek & Bersihkan Selokan di Depan Rumah",
    desc: "Pastikan tidak ada sampah plastik, ranting, atau endapan lumpur yang menyumbat jalur aliran pembuangan air.",
  },

  // Kategori 2: Saat Terjadi Banjir (Tanggap Darurat)
  {
    id: "dur-1",
    category: "saat",
    title: "Matikan Meteran Listrik Utama (MCB) & Cabut Gas",
    desc: "Cegah bahaya sengatan listrik (electrocution) dan kebocoran gas saat air mulai memasuki pekarangan rumah.",
  },
  {
    id: "dur-2",
    category: "saat",
    title: "Jauhkan & Awasi Ketat Anak-Anak dari Genangan Air",
    desc: "Jangan izinkan anak bermain di air banjir. Arus deras, saluran terbuka, dan kuman penyakit sangat berbahaya.",
  },
  {
    id: "dur-3",
    category: "saat",
    title: "Pindahkan Peralatan Elektronik ke Tempat Tinggi",
    desc: "Naikkan kulkas, TV, mesin cuci, dan kasur ke atas meja kokoh atau lantai dua rumah.",
  },
  {
    id: "dur-4",
    category: "saat",
    title: "Hindari Melintasi Arus Air Deras atau Jembatan Rawan",
    desc: "Ingat prinsip: Turn Around, Don't Drown. Air setinggi 30 cm dengan arus deras dapat merobohkan orang dewasa.",
  },
  {
    id: "dur-5",
    category: "saat",
    title: "Evakuasi ke Posko Pengungsian / Titik Kumpul Aman",
    desc: "Gunakan jalur evakuasi resmi yang telah ditentukan pemerintah kelurahan jika air terus naik di atas lutut.",
  },

  // Kategori 3: Pasca-Bencana (Setelah Air Surut)
  {
    id: "post-1",
    category: "pasca",
    title: "Pastikan Instalasi Listrik Kering Sebelum Dinyalakan",
    desc: "Gunakan jasa petugas PLN atau teknisi bersertifikat untuk memeriksa kabel yang sempat terendam air.",
  },
  {
    id: "post-2",
    category: "pasca",
    title: "Waspada Binatang Berbisa (Ular & Kelabang)",
    desc: "Gunakan sarung tangan karet dan sepatu bot saat membersihkan sisa lumpur atau perabotan yang basah.",
  },
  {
    id: "post-3",
    category: "pasca",
    title: "Kuras & Disinfeksi Sumber Air Bersih / Sumur",
    desc: "Gunakan air matang untuk minum dan memasak guna mencegah wabah diare dan penyakit leptospirosis.",
  },
];

const STORAGE_KEY = "webgis2mbc_checklist_state";

export default function PreparednessChecklist() {
  const [activeCategory, setActiveCategory] = useState("pra"); // "pra" | "saat" | "pasca"
  const [checkedIds, setCheckedIds] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(checkedIds));
    } catch (e) {}
  }, [checkedIds]);

  const toggleItem = (id) => {
    setCheckedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleReset = () => {
    if (window.confirm("Apakah Anda yakin ingin mengatur ulang centang panduan siaga?")) {
      setCheckedIds([]);
    }
  };

  // Hitung persentase
  const totalItems = DEFAULT_CHECKLIST.length;
  const completedCount = checkedIds.length;
  const progressPercent = Math.round((completedCount / totalItems) * 100);

  const filteredItems = DEFAULT_CHECKLIST.filter((i) => i.category === activeCategory);

  return (
    <section id="panduan" className="checklist-section">
      <div className="section-container">
        <div className="section-header-block">
          <div className="section-badge">
            <IconShield size={16} color="#176B65" />
            <span>Panduan Praktis Warga</span>
          </div>
          <h2 className="section-title">Daftar Kesiapsiagaan Banjir Keluarga</h2>
          <p className="section-subtitle">
            Ceklis interaktif langkah mitigasi mandiri untuk melindungi keselamatan keluarga dan harta benda Anda.
          </p>
        </div>

        {/* Progress Bar Kesiapsiagaan */}
        <div className="checklist-progress-card">
          <div className="progress-header-row">
            <div>
              <span className="progress-label">Progres Kesiapan Rumah Tangga Anda:</span>
              <strong className="progress-counts">
                {completedCount} dari {totalItems} Langkah Selesai ({progressPercent}%)
              </strong>
            </div>

            {completedCount > 0 && (
              <button type="button" onClick={handleReset} className="reset-checklist-btn">
                Reset Centang
              </button>
            )}
          </div>

          <div className="progress-bar-track">
            <div
              className="progress-bar-fill"
              style={{
                width: `${progressPercent}%`,
                backgroundColor: progressPercent === 100 ? "#2F855A" : progressPercent > 50 ? "#176B65" : "#D69E2E",
              }}
            />
          </div>
        </div>

        {/* Tab Kategori Kesiapan */}
        <div className="checklist-category-tabs">
          <button
            type="button"
            className={`cat-tab-btn ${activeCategory === "pra" ? "active" : ""}`}
            onClick={() => setActiveCategory("pra")}
          >
            🛡️ Pra-Bencana (Sebelum Banjir)
          </button>
          <button
            type="button"
            className={`cat-tab-btn ${activeCategory === "saat" ? "active" : ""}`}
            onClick={() => setActiveCategory("saat")}
          >
            🚨 Saat Banjir (Tanggap Darurat)
          </button>
          <button
            type="button"
            className={`cat-tab-btn ${activeCategory === "pasca" ? "active" : ""}`}
            onClick={() => setActiveCategory("pasca")}
          >
            🌱 Pasca-Bencana (Pemulihan)
          </button>
        </div>

        {/* Daftar Checklist Interaktif */}
        <div className="checklist-items-grid">
          {filteredItems.map((item) => {
            const isChecked = checkedIds.includes(item.id);
            return (
              <div
                key={item.id}
                className={`checklist-item-card ${isChecked ? "completed" : ""}`}
                onClick={() => toggleItem(item.id)}
                role="checkbox"
                aria-checked={isChecked}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleItem(item.id);
                  }
                }}
              >
                <div className={`checklist-checkbox ${isChecked ? "checked" : ""}`}>
                  {isChecked && <IconCheck size={14} color="#FFFFFF" />}
                </div>

                <div className="checklist-item-text">
                  <strong className="checklist-item-title">{item.title}</strong>
                  <p className="checklist-item-desc">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Kotak Darurat Call 112 */}
        <div className="emergency-call-banner">
          <div className="emergency-call-content">
            <div className="emergency-icon-wrap">
              <IconPhone size={24} color="#FFFFFF" />
            </div>
            <div>
              <strong className="emergency-call-title">Layanan Darurat Siaga Kota Makassar</strong>
              <p className="emergency-call-desc">
                Butuh evakuasi medis, perahu karet, atau bantuan penyelamatan korban banjir mendesak?
                Hubungi Call Center Bebas Pulsa Pemerintah Kota Makassar.
              </p>
            </div>
          </div>
          <a href="tel:112" className="emergency-call-btn">
            Hubungi Bebas Pulsa: 112
          </a>
        </div>

        <div className="checklist-disclaimer">
          <IconAlertTriangle size={14} color="#64748B" />
          <span>
            <strong>Peringatan Keselamatan:</strong> Menyelesaikan seluruh daftar ceklis ini merupakan upaya
            pengurangan risiko bencana (mitigasi), namun tidak menjamin kekebalan mutlak terhadap bencana alam ekstrem.
            Selalu patuhi instruksi evakuasi resmi dari BPBD Kota Makassar.
          </span>
        </div>
      </div>
    </section>
  );
}
