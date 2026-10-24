import React from "react";
import { IconFlask, IconClose, IconShield } from "../Icons";

export const PRESET_SKENARIO = {
  normal: {
    id: "normal",
    nama: "☀️ Skenario 1: Normal / Kemarau",
    desc: "Kondisi cuaca cerah tanpa hujan, elevasi air laut surut normal (+0.45 m), seluruh kanal lancar.",
    rainMm: 0,
    tideM: 0.45,
    depthCm: 0,
    riverOverflow: false,
    bufferM: 100,
  },
  hujan_lebat: {
    id: "hujan_lebat",
    nama: "🌧️ Skenario 2: Hujan Monsun Lebat",
    desc: "Curah hujan tinggi (65 mm/hari) memicu genangan air di titik-titik cekungan Antang & Panakkukang.",
    rainMm: 65,
    tideM: 1.05,
    depthCm: 45,
    riverOverflow: false,
    bufferM: 200,
  },
  pasut_rob: {
    id: "pasut_rob",
    nama: "🌊 Skenario 3: Puncak Pasang Rob Pesisir",
    desc: "Pasang laut Selat Makassar mencapai +1.52 m merendam pesisir Mariso, Ujung Tanah, dan Tallo.",
    rainMm: 20,
    tideM: 1.52,
    depthCm: 55,
    riverOverflow: true,
    bufferM: 300,
  },
  katastrofik: {
    id: "katastrofik",
    nama: "🚨 Skenario 4: Banjir Majemuk Katastrofik",
    desc: "Kombinasi maut: Hujan ekstrem 140 mm + Puncak Pasut Rob + Seluruh kanal meluap serentak.",
    rainMm: 140,
    tideM: 1.58,
    depthCm: 110,
    riverOverflow: true,
    bufferM: 500,
  },
};

export default function SimulationController({
  isSimulation,
  onToggleMode,
  simulationState,
  onChangeSimulation,
  onResetRealtime,
  isOpen,
  onClose,
}) {
  if (!isOpen) return null;

  return (
    <div className="sim-modal-overlay" role="dialog" aria-modal="true" aria-label="Mode Simulasi Pengujian">
      <div className="sim-modal-card">
        {/* Header Modal */}
        <div className="sim-modal-header">
          <div className="sim-header-title-wrap">
            <div className="sim-flask-icon-wrap">
              <IconFlask size={22} color="#0284C7" />
            </div>
            <div>
              <span className="sim-eyebrow">LABORATORIUM PENGUJIAN & SIDANG SKRIPSI</span>
              <h3 className="sim-modal-title">Mode Simulasi Skenario Bencana Banjir</h3>
            </div>
          </div>

          <button
            type="button"
            className="sim-modal-close"
            onClick={onClose}
            aria-label="Tutup panel simulasi"
          >
            <IconClose size={18} color="#64748B" />
          </button>
        </div>

        {/* Status Switcher: Real-Time vs Simulasi */}
        <div className="sim-mode-toggle-bar">
          <button
            type="button"
            className={`sim-toggle-pill ${!isSimulation ? "active-realtime" : ""}`}
            onClick={() => {
              if (isSimulation) onResetRealtime();
            }}
          >
            <span className="pill-dot realtime" />
            <span>Mode 1: Real-Time Live (API BMKG & Pasut)</span>
          </button>

          <button
            type="button"
            className={`sim-toggle-pill ${isSimulation ? "active-sim" : ""}`}
            onClick={() => {
              if (!isSimulation) onToggleMode(true);
            }}
          >
            <span className="pill-dot simulation" />
            <span>Mode 2: Simulasi Pengujian Kustom</span>
          </button>
        </div>

        {/* Body Modal */}
        <div className="sim-modal-body">
          {/* Bagian Preset Skenario */}
          <div className="sim-section">
            <span className="sim-section-label">PILIH SKENARIO PENGUJIAN CEPAT (PRESET):</span>
            <div className="sim-presets-grid">
              {Object.values(PRESET_SKENARIO).map((preset) => {
                const isSelected = isSimulation && simulationState.activePreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    className={`sim-preset-card ${isSelected ? "selected" : ""}`}
                    onClick={() => {
                      if (!isSimulation) onToggleMode(true);
                      onChangeSimulation({
                        ...preset,
                        activePreset: preset.id,
                      });
                    }}
                  >
                    <div className="preset-card-top">
                      <strong>{preset.nama}</strong>
                      {isSelected && <span className="preset-active-check">✓ Aktif</span>}
                    </div>
                    <p className="preset-desc">{preset.desc}</p>
                    <div className="preset-metrics-chips">
                      <span>🌧️ {preset.rainMm} mm</span>
                      <span>🌊 {preset.tideM} m</span>
                      <span>📏 {preset.depthCm} cm</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bagian Slider Kustom Manual */}
          <div className="sim-section">
            <span className="sim-section-label">PENGATURAN PARAMETER KUSTOM MANDIRI (SLIDER):</span>
            <div className="sim-sliders-grid">
              {/* Slider 1: Curah Hujan */}
              <div className="sim-slider-box">
                <div className="slider-header-row">
                  <span>🌧️ Curah Hujan Harian:</span>
                  <strong>{simulationState.rainMm} mm/hari</strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max="180"
                  step="5"
                  value={simulationState.rainMm}
                  onChange={(e) => {
                    if (!isSimulation) onToggleMode(true);
                    onChangeSimulation({
                      ...simulationState,
                      rainMm: Number(e.target.value),
                      activePreset: "custom",
                    });
                  }}
                  className="sim-range-input"
                />
                <div className="slider-labels">
                  <span>0 mm (Cerah)</span>
                  <span>50 mm (Lebat)</span>
                  <span>150+ mm (Ekstrem)</span>
                </div>
              </div>

              {/* Slider 2: Pasut Laut */}
              <div className="sim-slider-box">
                <div className="slider-header-row">
                  <span>🌊 Muka Pasang Air Laut (Selat Makassar):</span>
                  <strong>+{simulationState.tideM.toFixed(2)} m</strong>
                </div>
                <input
                  type="range"
                  min="0.30"
                  max="1.80"
                  step="0.05"
                  value={simulationState.tideM}
                  onChange={(e) => {
                    if (!isSimulation) onToggleMode(true);
                    onChangeSimulation({
                      ...simulationState,
                      tideM: Number(e.target.value),
                      activePreset: "custom",
                    });
                  }}
                  className="sim-range-input"
                />
                <div className="slider-labels">
                  <span>0.4 m (Surut)</span>
                  <span>1.0 m (Sedang)</span>
                  <span>1.5+ m (Puncak Rob)</span>
                </div>
              </div>

              {/* Slider 3: Radius Luapan Sempadan Sungai */}
              <div className="sim-slider-box">
                <div className="slider-header-row">
                  <span>🎯 Radius Bahaya Sempadan Kanal (Buffer):</span>
                  <strong>{simulationState.bufferM} meter</strong>
                </div>
                <input
                  type="range"
                  min="50"
                  max="800"
                  step="50"
                  value={simulationState.bufferM}
                  onChange={(e) => {
                    if (!isSimulation) onToggleMode(true);
                    onChangeSimulation({
                      ...simulationState,
                      bufferM: Number(e.target.value),
                      activePreset: "custom",
                    });
                  }}
                  className="sim-range-input"
                />
                <div className="slider-labels">
                  <span>50 m</span>
                  <span>250 m</span>
                  <span>500+ m</span>
                </div>
              </div>
            </div>
          </div>

          {/* Banner Penjelasan Akademis */}
          <div className="sim-academic-hint">
            <IconShield size={18} color="#0369A1" />
            <p>
              <strong>Fungsi Mode Simulasi untuk Pengujian:</strong> Mengubah parameter di atas akan langsung
              memperbarui pewarnaan tingkat risiko pada 153 kelurahan di peta, mengubah status rob pada widget pasang-surut,
              serta menguji kesiapan sistem navigasi evakuasi dalam menghadapi skenario darurat terburuk.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sim-modal-footer">
          <button
            type="button"
            className="sim-btn-reset"
            onClick={onResetRealtime}
          >
            Kembali ke Data Real-Time Asli
          </button>
          <button
            type="button"
            className="sim-btn-apply"
            onClick={onClose}
          >
            Terapkan & Lihat di Peta WebGIS
          </button>
        </div>
      </div>
    </div>
  );
}
