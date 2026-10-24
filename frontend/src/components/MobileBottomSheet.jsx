import React from "react";
import FloodDepthVisualization from "./FloodDepthVisualization";
import { getTypicalFloodDepth } from "./FloodDepthSimulator";
import { POSKO_EVAKUASI_MAKASSAR } from "../data/evakuasiDanKanal";
import {
  IconClose,
  IconShield,
  IconSliders,
  IconPhone,
  IconInfo,
  IconWhatsApp,
} from "../Icons";

export default function MobileBottomSheet({
  selected,
  onClose,
  prakiraan = [],
  loadingPrakiraan = false,
  errorPrakiraan = "",
  onOpenSimulator,
  onShowRoute,
  badge,
  elevasiVal,
  hujanVal,
  depthVal,
  isSimulation = false,
  simulationState = null,
}) {
  const [activeTab, setActiveTab] = React.useState("ikhtisar"); // "ikhtisar" | "kedalaman" | "cuaca"

  if (!selected) return null;

  const autoDepth = getTypicalFloodDepth(selected, isSimulation, simulationState);
  const effectiveDepth = depthVal !== null && depthVal > 0 ? depthVal : autoDepth;

  // FITUR 1: Bagikan Peringatan Kelurahan ke WhatsApp
  const handleShareWhatsApp = () => {
    const nearest =
      POSKO_EVAKUASI_MAKASSAR.find(
        (p) =>
          selected.kecamatan &&
          p.kecamatan.toLowerCase().includes(selected.kecamatan.toLowerCase())
      ) || POSKO_EVAKUASI_MAKASSAR[0];

    const lines = [
      `🚨 *PERINGATAN INFORMASI BANJIR KOTA MAKASSAR*`,
      `📍 *Wilayah:* Kel. ${selected.nama_kelurahan}, Kec. ${selected.kecamatan || "Makassar"}`,
      `⚠️ *Status Kerentanan:* ${badge?.label?.toUpperCase() || "WASPADA"}`,
      `⛰️ *Ketinggian Elevasi:* ${elevasiVal !== null ? `${elevasiVal} m dpl` : "Belum terdata"}`,
      `🌧️ *Curah Hujan Terkini:* ${hujanVal !== null ? `${hujanVal} mm` : "0 mm"}`,
      ``,
      `⛺ *Posko Evakuasi Terdekat:*`,
      `• *Nama:* ${nearest.nama}`,
      `• *Alamat:* ${nearest.alamat}`,
      `• *Kapasitas:* ±${nearest.kapasitas} Jiwa`,
      `• *Rute Maps Langsung:* https://www.google.com/maps/dir/?api=1&destination=${nearest.latitude},${nearest.longitude}`,
      ``,
      `📞 *Call Center Bencana Makassar:* 112 (Bebas Pulsa)`,
      `🌐 *Lihat Peta Spasial WebGIS:* ${typeof window !== "undefined" ? window.location.origin : "https://webgis-banjir-makassar.id"}`,
      ``,
      `_Pemberitahuan resmi dari Sistem Mitigasi Bencana WebGIS Kota Makassar_`,
    ];

    const text = lines.join("\n");
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  return (
    <div className="mobile-bottom-sheet" role="dialog" aria-label={`Detail Kelurahan ${selected.nama_kelurahan}`}>
      {/* Handle Bar Drag Indikator */}
      <div className="sheet-drag-handle" />

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
          <span className="sheet-sub">
            {selected.kecamatan ? `Kec. ${selected.kecamatan}` : "Kota Makassar"} &bull; Kode: {selected.kode_wilayah || "-"}
          </span>
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

      {/* FITUR 1: Quick Action Button: Bagikan WA, Hubungi 112 & Simulasi */}
      <div className="sheet-quick-actions">
        <button
          type="button"
          className="sheet-whatsapp-btn"
          onClick={handleShareWhatsApp}
          title="Bagikan peringatan ini ke WhatsApp"
        >
          <IconWhatsApp size={15} color="#FFFFFF" />
          <span>Bagikan ke WA</span>
        </button>

        <a href="tel:112" className="sheet-call-btn">
          <IconPhone size={15} color="#FFFFFF" />
          <span>Call 112</span>
        </a>

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
            <div className="sheet-stats-grid">
              <div className="sheet-stat-box">
                <span className="stat-label">ELEVASI TANAH</span>
                <strong className="stat-val">{elevasiVal !== null ? `${elevasiVal} m dpl` : "Belum terdata"}</strong>
                <span className="stat-source">Copernicus DEM GLO-90</span>
              </div>
              <div className="sheet-stat-box">
                <span className="stat-label">CURAH HUJAN HARI INI</span>
                <strong className="stat-val">{hujanVal !== null ? `${hujanVal} mm` : "0 mm"}</strong>
                <span className="stat-source">Open-Meteo API</span>
              </div>
            </div>

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
              <p className="meaning-text">
                {elevasiVal !== null && elevasiVal < 5
                  ? `Wilayah ini berada pada elevasi rendah (${elevasiVal} m dpl) mendekati muara/laut, sehingga pembuangan air hujan lebih lambat saat pasang laut (rob).`
                  : `Wilayah ini berada pada elevasi ${elevasiVal ?? "-"} m dpl dengan kemiringan yang membantu gravitasi drainase.`}
              </p>
            </div>

            {/* POSKO EVAKUASI TERDEKAT */}
            {(() => {
              const nearest =
                POSKO_EVAKUASI_MAKASSAR.find(
                  (p) =>
                    selected.kecamatan &&
                    p.kecamatan.toLowerCase().includes(selected.kecamatan.toLowerCase())
                ) || POSKO_EVAKUASI_MAKASSAR[0];

              return (
                <div className="shelter-info-box" style={{ marginTop: "10px" }}>
                  <div className="shelter-box-header">
                    <span style={{ fontSize: "18px" }}>⛺</span>
                    <div>
                      <strong style={{ fontSize: "12px", color: "#166534", display: "block" }}>
                        Posko Evakuasi: {nearest.nama}
                      </strong>
                      <span style={{ fontSize: "11px", color: "#475569" }}>
                        📍 {nearest.alamat} &bull; ±{nearest.kapasitas} Jiwa
                      </span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
                    <button
                      type="button"
                      onClick={() => {
                        if (onShowRoute) onShowRoute(selected, nearest);
                      }}
                      className="shelter-nav-btn"
                    >
                      🚶‍♂️ Rute Aman
                    </button>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${nearest.latitude},${nearest.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shelter-call-btn"
                      style={{ background: "#F1F5F9", color: "#1E293B", textDecoration: "none" }}
                    >
                      🗺️ Maps
                    </a>
                    <a href={`tel:${nearest.kontak.replace(/[^0-9]/g, "") || "112"}`} className="shelter-call-btn">
                      📞 Kontak
                    </a>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Tab 2: Ketinggian Air Skala Manusia (Otomatis & Real-Time) */}
        {activeTab === "kedalaman" && (
          <div className="sheet-tab-pane">
            <div className="auto-depth-header-banner" style={{ marginBottom: "12px" }}>
              <div className="auto-depth-pill-row">
                <span className={`auto-depth-mode-pill ${depthVal ? "pill-verified" : isSimulation ? "pill-sim" : "pill-auto"}`}>
                  {depthVal ? "📡 Data Riil" : isSimulation ? "⚡ Mode Simulasi" : "🤖 Otomatis Sesuai Wilayah"}
                </span>
                <span className="auto-depth-area-name">{selected.nama_kelurahan}</span>
              </div>
              <div className="auto-depth-title-row">
                <span className="auto-depth-caption">Estimasi Genangan:</span>
                <strong
                  className="auto-depth-value"
                  style={{
                    color: effectiveDepth >= 60 ? "#C53030" : effectiveDepth >= 30 ? "#DD6B20" : effectiveDepth > 0 ? "#D69E2E" : "#2F855A"
                  }}
                >
                  {effectiveDepth} cm
                </strong>
              </div>
            </div>

            <FloodDepthVisualization
              depthCm={effectiveDepth}
              isSimulation={!depthVal}
              showImpactCards={true}
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
                <span>Ubah Ketinggian di Simulator Interaktif</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Cuaca BMKG */}
        {activeTab === "cuaca" && (
          <div className="sheet-tab-pane">
            <div className="sheet-bmkg-header">
              <strong>Prakiraan Cuaca BMKG 3-Harian</strong>
              <span>Sumber: API Resmi BMKG</span>
            </div>

            {loadingPrakiraan ? (
              <p style={{ fontSize: "12px", color: "#64748B", padding: "12px 0", textAlign: "center" }}>
                ⏳ Mengambil data cuaca BMKG...
              </p>
            ) : errorPrakiraan ? (
              <p style={{ fontSize: "12px", color: "#C53030", padding: "8px 0" }}>⚠️ {errorPrakiraan}</p>
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
              <p style={{ fontSize: "12px", color: "#64748B" }}>Prakiraan cuaca spesifik belum tersedia.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
