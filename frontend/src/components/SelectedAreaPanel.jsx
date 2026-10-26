import React, { useState } from "react";
import FloodDepthEstimate from "./FloodDepthEstimate";
import CitizenActionHub from "./CitizenActionHub";
import {
  IconClose,
  IconShield,
  IconInfo,
} from "../Icons";

export function getRiskBadge(tingkatStr) {
  const norm = String(tingkatStr || "").toLowerCase();
  if (norm.includes("sangat") || norm.includes("ekstrem")) {
    return {
      key: "sangat_tinggi",
      label: "Bahaya Ekstrem",
      color: "#C53030",
      bg: "rgba(197, 48, 48, 0.12)",
      border: "#C53030",
      desc: "Wilayah berisiko banjir sangat tinggi. Memerlukan kewaspadaan ekstra dan kesiapan evakuasi.",
    };
  }
  if (norm.includes("tinggi") || norm.includes("siaga")) {
    return {
      key: "tinggi",
      label: "Siaga Banjir",
      color: "#DD6B20",
      bg: "rgba(221, 107, 32, 0.12)",
      border: "#DD6B20",
      desc: "Potensi genangan signifikan pada titik dataran rendah dan bantaran drainase utama.",
    };
  }
  if (norm.includes("sedang") || norm.includes("waspada")) {
    return {
      key: "sedang",
      label: "Waspada",
      color: "#D69E2E",
      bg: "rgba(214, 158, 46, 0.12)",
      border: "#D69E2E",
      desc: "Berpotensi terjadi genangan sesaat ketika hujan deras dengan durasi lama.",
    };
  }
  if (norm.includes("rendah") || norm.includes("aman")) {
    return {
      key: "rendah",
      label: "Aman Berdasarkan Data Tersedia",
      color: "#2F855A",
      bg: "rgba(47, 133, 90, 0.12)",
      border: "#2F855A",
      desc: "Risiko genangan rendah pada kondisi saat ini. Tetap pantau saluran drainase lingkungan.",
    };
  }
  return {
    key: "belum",
    label: "Data Belum Tersedia",
    color: "#94A3B8",
    bg: "rgba(148, 163, 184, 0.12)",
    border: "#94A3B8",
    desc: "Belum ada catatan risiko genangan terverifikasi untuk wilayah ini.",
  };
}

export default function SelectedAreaPanel({
  selected,
  onClose,
  prakiraan = [],
  loadingPrakiraan = false,
  errorPrakiraan = "",
  onRefreshPrakiraan,
  onShowRoute,
}) {
  const [panelTab, setPanelTab] = useState("ikhtisar");

  if (!selected) return null;

  const badge = getRiskBadge(selected.tingkat);

  // Interpretasi "Apa Artinya bagi Saya?" dengan aturan eksplisit dan jujur
  const getMeaningForUser = () => {
    const points = [];

    if (badge.key === "sangat_tinggi" || badge.key === "tinggi") {
      points.push("Wilayah ini tercatat memiliki kerentanan genangan banjir yang tinggi berdasarkan kontur elevasi dan riwayat banjir.");
    } else if (badge.key === "sedang") {
      points.push("Wilayah ini berpotensi mengalami genangan air di titik-titik cekungan saat hujan deras berlangsung lebih dari 2 jam.");
    } else {
      points.push("Berdasarkan data yang tersedia saat ini, wilayah ini memiliki risiko genangan relatif rendah.");
    }

    points.push("Ketinggian genangan aktual belum tersedia dari sensor di titik ini. Hindari menyimpulkan kedalaman air tanpa pengamatan lapangan.");

    return points;
  };

  return (
    <div className="selected-area-card" role="region" aria-label={`Detail Risiko Kelurahan ${selected.nama_kelurahan}`}>
      {/* Header Panel */}
      <div className="selected-card-header">
        <div>
          <span className="selected-eyebrow">KELURAHAN TERPILIH</span>
          <h2 className="selected-title">{selected.nama_kelurahan}</h2>
          <span className="selected-sub">
            {selected.kecamatan ? `Kecamatan ${selected.kecamatan}` : "Kota Makassar"}
          </span>
        </div>

        <button
          type="button"
          className="selected-close-btn"
          onClick={onClose}
          aria-label="Tutup panel kelurahan terpilih"
        >
          <IconClose size={18} color="#64748B" />
        </button>
      </div>

      {/* Hero Badge Status Risiko */}
      <div
        className="selected-risk-hero"
        style={{
          background: badge.bg,
          borderLeft: `4px solid ${badge.border}`,
        }}
      >
        <div className="risk-hero-header">
          <IconShield size={20} color={badge.color} />
          <strong style={{ color: badge.color }}>{badge.label}</strong>
        </div>
        <p className="risk-hero-desc">{badge.desc}</p>
      </div>

      {/* Aksi warga dipasang di luar area gulir agar selalu terlihat pada laptop. */}
      {panelTab === "ikhtisar" && (
        <CitizenActionHub selected={selected} badge={badge} prakiraan={prakiraan} onShowRoute={onShowRoute} />
      )}

      {/* Tab Navigasi Panel */}
      <div className="selected-panel-tabs">
        <button
          type="button"
          className={`panel-tab-btn ${panelTab === "ikhtisar" ? "active" : ""}`}
          onClick={() => setPanelTab("ikhtisar")}
        >
          Ikhtisar
        </button>
        <button
          type="button"
          className={`panel-tab-btn ${panelTab === "cuaca" ? "active" : ""}`}
          onClick={() => setPanelTab("cuaca")}
        >
          Prakiraan Cuaca
        </button>
      </div>

      {/* Konten Tab 1: Ikhtisar Wilayah & Data Fisik */}
      {panelTab === "ikhtisar" && (
        <div className="panel-tab-content">
          <FloodDepthEstimate
            depthCm={selected.estimasi_kedalaman_cm}
            weatherCondition={selected.kondisi_bmkg}
            updatedAt={selected.waktu_analisis}
          />

          {/* Bagian: Apa Artinya bagi Saya? */}
          <div className="meaning-section">
            <div className="meaning-title">
              <IconInfo size={16} color="#176B65" />
              <strong>Apa Artinya bagi Saya?</strong>
            </div>
            <ul className="meaning-list">
              {getMeaningForUser().map((text, idx) => (
                <li key={`meaning-${idx}`}>{text}</li>
              ))}
            </ul>
          </div>

          {/* Rekomendasi Keselamatan Praktis */}
          <div className="action-recommendation-box">
            <strong>Rekomendasi Tindakan Warga:</strong>
            <ul className="recommendation-list">
              <li>Pantau pembaharuan prakiraan cuaca resmi BMKG secara berkala.</li>
              <li>Amankan dokumen penting ke tempat tinggi atau wadah kedap air.</li>
              <li>Jangan biarkan anak-anak bermain di tepi saluran air atau selokan.</li>
              <li>Simpan nomor darurat <strong>Call Center Makassar 112</strong> di ponsel Anda.</li>
            </ul>
          </div>

        </div>
      )}

      {/* Konten Tab 2: Prakiraan Cuaca BMKG */}
      {panelTab === "cuaca" && (
        <div className="panel-tab-content">
          <div className="bmkg-forecast-header">
            <div>
              <strong style={{ fontSize: "14px", color: "#172B3A", display: "block" }}>
                Prakiraan Cuaca BMKG
              </strong>
              <span style={{ fontSize: "12px", color: "#64748B" }}>
                Kelurahan {selected.nama_kelurahan} &bull; Sumber: API Resmi BMKG
              </span>
            </div>
            <span className="forecast-type-tag">Prakiraan 3 Harian</span>
          </div>

          {loadingPrakiraan ? (
            <div className="forecast-loading-state">
              <span>⏳ Mengambil data cuaca BMKG terkini...</span>
            </div>
          ) : errorPrakiraan ? (
            <div className="forecast-error-state">
              <span>⚠️ {errorPrakiraan}</span>
              <button type="button" onClick={onRefreshPrakiraan}>Coba lagi</button>
            </div>
          ) : prakiraan.length > 0 ? (
            <div className="forecast-cards-scroll">
              {prakiraan.slice(0, 8).map((f, idx) => (
                <div key={`fc-card-${idx}`} className="forecast-mini-card">
                  <span className="fc-time">
                    {f.waktu_lokal ? f.waktu_lokal.split(" ")[1]?.slice(0, 5) : `+${idx * 3}j`}
                  </span>
                  <span className="fc-date">
                    {f.waktu_lokal ? f.waktu_lokal.split(" ")[0]?.slice(5) : ""}
                  </span>
                  <span className="fc-icon">
                    {f.kondisi?.toLowerCase().includes("hujan") ? "🌧️" : f.kondisi?.toLowerCase().includes("cerah") ? "☀️" : "⛅"}
                  </span>
                  <strong className="fc-temp">{f.suhu_c != null ? `${f.suhu_c}°C` : "-"}</strong>
                  <span className="fc-cond">{f.kondisi || "Berawan"}</span>
                  <span className="fc-hum">💧 {f.kelembapan_persen != null ? `${f.kelembapan_persen}%` : "-"}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="forecast-empty-state">
              <p>Prakiraan cuaca spesifik belum tersedia untuk kelurahan ini.</p>
              <button type="button" onClick={onRefreshPrakiraan}>Perbarui prakiraan</button>
            </div>
          )}

          <div className="forecast-disclaimer">
            <IconInfo size={13} color="#64748B" />
            <span>
              Data ini merupakan <strong>prakiraan cuaca</strong> dari BMKG, bukan catatan observasi hujan harian yang telah terjadi.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
