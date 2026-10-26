import React, { useEffect, useMemo, useState } from "react";
import { POSKO_EVAKUASI_MAKASSAR } from "../data/evakuasiDanKanal";

const SAVED_AREA_KEY = "webgis2mbc_saved_kelurahan";

function getNearestShelter(selected) {
  return (
    POSKO_EVAKUASI_MAKASSAR.find(
      (item) => selected.kecamatan && item.kecamatan.toLowerCase().includes(selected.kecamatan.toLowerCase())
    ) || POSKO_EVAKUASI_MAKASSAR[0]
  );
}

export default function CitizenActionHub({ selected, badge, prakiraan = [], onShowRoute }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [waterLevel, setWaterLevel] = useState("Setinggi mata kaki");

  useEffect(() => {
    try {
      const names = JSON.parse(localStorage.getItem(SAVED_AREA_KEY) || "[]");
      setSaved(names.includes(selected.kode_wilayah));
    } catch {
      setSaved(false);
    }
  }, [selected.kode_wilayah]);

  const shelter = useMemo(() => getNearestShelter(selected), [selected]);
  const action = badge?.key === "sangat_tinggi" || badge?.key === "tinggi"
    ? "Siapkan tas siaga, amankan dokumen, dan pertimbangkan rute menuju posko."
    : badge?.key === "sedang"
      ? "Pantau cuaca, bersihkan saluran dekat rumah, dan siapkan dokumen penting."
      : "Tetap pantau pembaruan cuaca dan hindari saluran saat hujan deras.";

  const toggleSaved = () => {
    try {
      const names = JSON.parse(localStorage.getItem(SAVED_AREA_KEY) || "[]");
      const updated = saved ? names.filter((code) => code !== selected.kode_wilayah) : [...new Set([...names, selected.kode_wilayah])];
      localStorage.setItem(SAVED_AREA_KEY, JSON.stringify(updated));
      setSaved(!saved);
    } catch {
      // Penyimpanan preferensi adalah pelengkap dan tidak menghambat tindakan keselamatan.
    }
  };

  const shareStatus = async (reportText = "") => {
    const message = reportText || `Info kesiapsiagaan banjir: Kelurahan ${selected.nama_kelurahan} berstatus ${badge?.label || "dipantau"}. ${action}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Kesiapsiagaan Banjir Makassar", text: message });
        return;
      } catch (error) {
        if (error.name === "AbortError") return;
      }
    }
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };

  const sendReport = () => {
    const message = `Laporan warga WebGIS Makassar: Kelurahan ${selected.nama_kelurahan}, kondisi genangan ${waterLevel}. Waktu laporan: ${new Date().toLocaleString("id-ID")}. Mohon verifikasi lapangan.`;
    setReportSent(true);
    shareStatus(message);
  };

  return (
    <section className="citizen-action-hub" aria-label="Pusat tindakan warga">
      <button type="button" className="citizen-action-trigger" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span className="citizen-action-icon">✦</span>
        <span><strong>Bantuan & tindakan warga</strong><small>{badge?.label || "Pantau kondisi wilayah"}</small></span>
        <span className="citizen-action-chevron">{open ? "⌃" : "⌄"}</span>
      </button>

      {open && (
        <div className="citizen-action-content">
          <div className="citizen-action-summary">
            <span>Langkah sekarang</span>
            <p>{action}</p>
          </div>

          <div className="citizen-action-grid">
            <button type="button" onClick={() => onShowRoute?.(selected, shelter)}>🧭 Rute ke posko</button>
            <a href="tel:112">☎ Hubungi 112</a>
            <button type="button" onClick={() => shareStatus()}>↗ Bagikan status</button>
            <button type="button" onClick={() => setShowReport((value) => !value)}>⚑ Lapor genangan</button>
          </div>

          <div className="citizen-action-shelter">
            <strong>Posko terdekat: {shelter.nama}</strong>
            <span>{shelter.alamat}</span>
          </div>

          <div className="citizen-action-bottom">
            <button type="button" className={saved ? "saved" : ""} onClick={toggleSaved}>
              {saved ? "✓ Kelurahan tersimpan" : "+ Simpan kelurahan ini"}
            </button>
            {prakiraan[0] && <span>Cuaca berikutnya: {prakiraan[0].kondisi || "Berawan"} · {prakiraan[0].suhu_c ?? "-"}°C</span>}
          </div>

          {showReport && (
            <div className="citizen-report-form">
              <label htmlFor="water-level">Perkiraan tinggi genangan</label>
              <select id="water-level" value={waterLevel} onChange={(event) => setWaterLevel(event.target.value)}>
                <option>Belum ada genangan</option><option>Setinggi mata kaki</option><option>Setinggi lutut</option><option>Setinggi pinggang atau lebih</option>
              </select>
              <button type="button" onClick={sendReport}>{reportSent ? "Kirim pembaruan laporan" : "Siapkan laporan untuk dibagikan"}</button>
              <small>Laporan dibuka melalui fitur berbagi ponsel/WhatsApp agar dapat diteruskan ke kanal warga atau petugas.</small>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
