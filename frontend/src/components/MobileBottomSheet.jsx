import React from "react";
import FloodDepthEstimate from "./FloodDepthEstimate";
import CitizenActionHub from "./CitizenActionHub";
import {
  IconClose,
  IconShield,
  IconSliders,
  IconInfo,
} from "../Icons";

export default function MobileBottomSheet({
  selected,
  onClose,
  prakiraan = [],
  loadingPrakiraan = false,
  errorPrakiraan = "",
  onRefreshPrakiraan,
  onOpenSimulator,
  onShowRoute,
  badge,
}) {
  const [activeTab, setActiveTab] = React.useState("ikhtisar"); // "ikhtisar" | "kedalaman" | "cuaca"
  const [sheetState, setSheetState] = React.useState("peek"); // "peek" (ringkas) | "half" | "expanded" (penuh)

  if (!selected) return null;

  const effectiveDepth = Number(selected.estimasi_kedalaman_cm) || 0;

  const cycleSheetState = () => {
    if (sheetState === "peek") setSheetState("half");
    else if (sheetState === "half") setSheetState("expanded");
    else setSheetState("peek");
  };

  return (
    <div
      className={`mobile-bottom-sheet sheet-state-${sheetState}`}
      role="dialog"
      aria-label={`Detail Kelurahan ${selected.nama_kelurahan}`}
    >
      {/* Handle Bar Drag Indikator (Tap to toggle peek/expanded) */}
      <div
        className="sheet-drag-handle"
        onClick={cycleSheetState}
        title="Ketuk untuk memperluas atau memperkecil panel"
      />

      {/* Header Bottom Sheet */}
      <div className="sheet-header">
        <div className="sheet-header-info">
          <div className="sheet-title-row">
            <h3 className="sheet-title">{selected.nama_kelurahan}</h3>
            <span
              className="sheet-risk-badge"
              style={{
                backgroundColor: badge.bg,
                color: badge.color,
                borderColor: badge.border,
              }}
            >
              {badge.label}
            </span>
          </div>
          <span className="sheet-sub">{selected.kecamatan ? `Kecamatan ${selected.kecamatan}` : "Kota Makassar"}</span>
        </div>

        <button
          type="button"
          className="sheet-close-btn"
          onClick={onClose}
          aria-label="Tutup lembar informasi"
        >
          <IconClose size={18} color="#64748B" />
        </button>
      </div>

      {/* Simulator adalah alat terpisah; bantuan warga digabungkan di Ikhtisar. */}
      <div className="sheet-quick-actions">
        <button
          type="button"
          className="sheet-sim-btn"
          onClick={() => {
            if (onOpenSimulator) onOpenSimulator();
          }}
          title="Buka simulator kedalaman"
        >
          <IconSliders size={15} color="#176B65" />
          <span>Simulasi</span>
        </button>
      </div>

      {/* Tab Navigasi Ramah Jempol */}
      <div className="sheet-nav-tabs">
        <button
          type="button"
          className={`sheet-tab ${activeTab === "ikhtisar" ? "active" : ""}`}
          onClick={() => setActiveTab("ikhtisar")}
        >
          Ikhtisar
        </button>
        <button
          type="button"
          className={`sheet-tab ${activeTab === "kedalaman" ? "active" : ""}`}
          onClick={() => setActiveTab("kedalaman")}
        >
          Ketinggian Air
        </button>
        <button
          type="button"
          className={`sheet-tab ${activeTab === "cuaca" ? "active" : ""}`}
          onClick={() => setActiveTab("cuaca")}
        >
          Cuaca BMKG
        </button>
      </div>

      {/* Konten Tab Scrollable */}
      <div className="sheet-body-content">
        {/* Tab 1: Ikhtisar */}
        {activeTab === "ikhtisar" && (
          <div className="sheet-tab-pane">
            <div className="sheet-desc-box" style={{ borderLeftColor: badge.color }}>
              <div className="desc-box-title">
                <IconShield size={16} color={badge.color} />
                <strong style={{ color: badge.color }}>Penilaian Risiko: {badge.label}</strong>
              </div>
              <p className="desc-box-text">{badge.desc}</p>
            </div>

            <div className="sheet-meaning-box">
              <div className="meaning-title">
                <IconInfo size={15} color="#176B65" />
                <strong>Apa Artinya bagi Saya?</strong>
              </div>
              <p className="meaning-text" style={{ marginBottom: "6px" }}>
                {badge.key === "sangat_tinggi" || badge.key === "tinggi"
                  ? "Wilayah ini tercatat memiliki kerentanan genangan banjir tinggi berdasarkan kontur elevasi rendah dan riwayat saluran drainase. Siapkan langkah mitigasi."
                  : badge.key === "sedang"
                    ? "Wilayah ini berpotensi terjadi genangan air di titik-titik cekungan saat curah hujan deras berlangsung lebih dari 2 jam."
                    : "Berdasarkan data spasial saat ini, wilayah ini memiliki risiko genangan relatif rendah. Tetap pantau drainase lingkungan."}
              </p>
              <div style={{ fontSize: "11px", color: "#64748B", background: "#F8FAFC", padding: "6px 8px", borderRadius: "6px" }}>
                💡 <strong>Tips Warga:</strong> Amankan dokumen penting, simpan nomor darurat <strong>Call Center 112</strong>, dan cek jalur posko terdekat.
              </div>
            </div>

            <CitizenActionHub selected={selected} badge={badge} prakiraan={prakiraan} onShowRoute={onShowRoute} />

          </div>
        )}

        {/* Tab 2: Ketinggian Air Skala Manusia (Otomatis & Real-Time) */}
        {activeTab === "kedalaman" && (
          <div className="sheet-tab-pane">
            <FloodDepthEstimate
              depthCm={effectiveDepth}
              weatherCondition={selected.kondisi_bmkg}
              updatedAt={selected.waktu_analisis}
            />

            <div style={{ marginTop: "12px" }}>
              <button
                type="button"
                className="sheet-open-sim-btn"
                onClick={() => {
                  if (onOpenSimulator) onOpenSimulator();
                }}
              >
                <IconSliders size={16} color="#FFFFFF" />
                <span>Coba Simulator Ketinggian Air</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Cuaca BMKG */}
        {activeTab === "cuaca" && (
          <div className="sheet-tab-pane">
            <div className="sheet-bmkg-header">
              <strong>Prakiraan Cuaca BMKG</strong>
              <span>Sumber: API Resmi BMKG</span>
            </div>

            {loadingPrakiraan ? (
              <p style={{ fontSize: "12px", color: "#64748B", padding: "12px 0", textAlign: "center" }}>
                ⏳ Mengambil data cuaca BMKG...
              </p>
            ) : errorPrakiraan ? (
              <div className="sheet-forecast-message sheet-forecast-error">
                <p>⚠️ {errorPrakiraan}</p>
                <button type="button" onClick={onRefreshPrakiraan}>Coba lagi</button>
              </div>
            ) : prakiraan.length > 0 ? (
              <div className="sheet-weather-scroll">
                {prakiraan.slice(0, 8).map((f, idx) => (
                  <div key={`m-fc-${idx}`} className="sheet-weather-card">
                    <span className="w-time">{f.waktu_lokal ? f.waktu_lokal.split(" ")[1]?.slice(0, 5) : `+${idx * 3}j`}</span>
                    <span className="w-icon">
                      {f.kondisi?.toLowerCase().includes("hujan") ? "🌧️" : f.kondisi?.toLowerCase().includes("cerah") ? "☀️" : "⛅"}
                    </span>
                    <strong className="w-temp">{f.suhu_c != null ? `${f.suhu_c}°C` : "-"}</strong>
                    <span className="w-cond">{f.kondisi || "Berawan"}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="sheet-forecast-message">
                <p>Prakiraan cuaca spesifik belum tersedia.</p>
                <button type="button" onClick={onRefreshPrakiraan}>Perbarui prakiraan</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
