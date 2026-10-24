import React, { useState, useEffect, useMemo } from "react";
import FloodDepthVisualization from "./FloodDepthVisualization";
import { IconSliders, IconAlertTriangle, IconCompass } from "../Icons";

const PRESETS = [
  { label: "Kering (0 cm)", value: 0, desc: "Kondisi normal / jalan kering" },
  { label: "Mata Kaki (15 cm)", value: 15, desc: "Genangan jalanan awal" },
  { label: "Betis (35 cm)", value: 35, desc: "Batas aman motor matic" },
  { label: "Lutut (60 cm)", value: 60, desc: "Bahaya tinggi anak & mobil sedan" },
  { label: "Pinggang (100 cm)", value: 100, desc: "Banjir parah / evakuasi" },
  { label: "Dada (150 cm)", value: 150, desc: "Bencana banjir bandang" },
];

// Perkiraan kedalaman tipikal banjir Makassar berdasarkan riwayat kerentanan wilayah
export function getTypicalFloodDepth(kelurahan, isSimulation, simulationState) {
  if (!kelurahan) return 0;

  // Jika kelurahan memiliki sensor observasi aktual
  if (kelurahan.kedalaman_air_cm !== null && kelurahan.kedalaman_air_cm !== undefined) {
    return kelurahan.kedalaman_air_cm;
  }

  // Jika sedang dalam Mode Simulasi Bencana
  if (isSimulation && simulationState) {
    const simBase = simulationState.depthCm ?? 40;
    const norm = String(kelurahan.tingkat || "").toLowerCase();
    if (norm.includes("sangat") || norm.includes("ekstrem")) return simBase;
    if (norm.includes("tinggi") || norm.includes("siaga")) return Math.round(simBase * 0.7);
    if (norm.includes("sedang") || norm.includes("waspada")) return Math.round(simBase * 0.4);
    return Math.max(0, Math.round(simBase * 0.1));
  }

  // Model empiris historis banjir Kota Makassar (berdasarkan kontur cekungan & pesisir)
  const norm = String(kelurahan.tingkat || "").toLowerCase();
  const nama = String(kelurahan.nama_kelurahan || "").toLowerCase();

  if (nama.includes("antang") || nama.includes("tamangapa")) return 85;
  if (nama.includes("camba berua") || nama.includes("buloa") || nama.includes("tallo")) return 65;
  if (nama.includes("mariso") || nama.includes("mattoanging")) return 50;

  if (norm.includes("sangat") || norm.includes("ekstrem")) return 75;
  if (norm.includes("tinggi") || norm.includes("siaga")) return 45;
  if (norm.includes("sedang") || norm.includes("waspada")) return 20;
  return 0;
}

export default function FloodDepthSimulator({
  defaultDepth = 35,
  selectedKelurahan = null,
  isSimulation = false,
  simulationState = null,
  onSelectKelurahanQuick,
}) {
  // Mode Operasi: "otomatis" (mengikuti kelurahan terpilih di peta) | "custom" (bebas geser slider)
  const [simulatorMode, setSimulatorMode] = useState(selectedKelurahan ? "otomatis" : "custom");
  const [customDepth, setCustomDepth] = useState(defaultDepth);

  // Jika kelurahan di peta berubah dan pengguna ada di mode otomatis, sinkronkan
  useEffect(() => {
    if (selectedKelurahan) {
      setSimulatorMode("otomatis");
    }
  }, [selectedKelurahan]);

  // Hitung kedalaman otomatis untuk kelurahan terpilih
  const autoDepth = useMemo(() => {
    return getTypicalFloodDepth(selectedKelurahan, isSimulation, simulationState);
  }, [selectedKelurahan, isSimulation, simulationState]);

  // Kedalaman efektif yang di-render ke visualisasi skala manusia
  const activeDepth = simulatorMode === "otomatis" && selectedKelurahan ? autoDepth : customDepth;

  return (
    <div className="flood-simulator-card" id="simulasi-ketinggian-container">
      {/* Header Simulator */}
      <div className="simulator-header">
        <div className="simulator-title-group">
          <div className="simulator-icon-badge">
            <IconSliders size={20} color="#176B65" />
          </div>
          <div>
            <h3 className="simulator-title">Simulator Interaktif Ketinggian Air (Skala Manusia)</h3>
            <p className="simulator-subtitle">
              Pilih mode otomatis untuk melihat dampak pada kelurahan di peta, atau mode kustom untuk menguji ketinggian air sendiri.
            </p>
          </div>
        </div>

        {/* Tab Switcher 2 Mode: Otomatis vs Kustom */}
        <div className="simulator-mode-switch-pills">
          <button
            type="button"
            className={`sim-mode-pill ${simulatorMode === "otomatis" ? "active" : ""}`}
            onClick={() => setSimulatorMode("otomatis")}
            title="Otomatis mengikuti kedalaman genangan kelurahan yang diklik di peta"
          >
            <span>📍 Mode Otomatis (Peta)</span>
            {selectedKelurahan && <span className="pill-active-dot" />}
          </button>
          <button
            type="button"
            className={`sim-mode-pill ${simulatorMode === "custom" ? "active" : ""}`}
            onClick={() => {
              setSimulatorMode("custom");
              setCustomDepth(activeDepth);
            }}
            title="Bebas menggeser slider ketinggian air secara manual"
          >
            <span>🎛️ Mode Kustom Mandiri</span>
          </button>
        </div>
      </div>

      {/* PANEL 1: KONDISI MODE OTOMATIS */}
      {simulatorMode === "otomatis" && (
        <div className="sim-auto-mode-banner">
          {selectedKelurahan ? (
            <div className="auto-kel-info-card">
              <div className="auto-card-left">
                <span className="auto-tag-badge">TERHUBUNG OTOMATIS DENGAN PETA WEBGIS</span>
                <h4 className="auto-kel-name">
                  Kelurahan {selectedKelurahan.nama_kelurahan}
                  {selectedKelurahan.kecamatan ? ` (Kec. ${selectedKelurahan.kecamatan})` : ""}
                </h4>
                <div className="auto-metrics-sub">
                  <span>Status: <strong>{selectedKelurahan.tingkat || "Siaga"}</strong></span>
                  <span>&bull;</span>
                  <span>Elevasi: <strong>{selectedKelurahan.elevasi_m !== null ? `${selectedKelurahan.elevasi_m} m dpl` : "-"}</strong></span>
                  {isSimulation && <span>&bull; <strong style={{ color: "#0284C7" }}>🧪 Skenario Simulasi</strong></span>}
                </div>
              </div>

              <div className="auto-card-right">
                <div className="auto-depth-stat">
                  <span className="stat-label">KETINGGIAN AIR SIMULASI:</span>
                  <strong className="stat-val">{autoDepth} cm</strong>
                  <span className="stat-sub">({(autoDepth / 100).toFixed(2)} meter)</span>
                </div>
                <button
                  type="button"
                  className="auto-switch-custom-btn"
                  onClick={() => {
                    setCustomDepth(autoDepth);
                    setSimulatorMode("custom");
                  }}
                  title="Salin nilai ini dan ubah secara bebas dengan slider"
                >
                  🎛️ Ubah Nilai di Mode Kustom
                </button>
              </div>
            </div>
          ) : (
            <div className="auto-empty-prompt">
              <IconCompass size={24} color="#176B65" />
              <div>
                <strong>Belum ada kelurahan yang dipilih di peta.</strong>
                <p>Klik salah satu kelurahan pada peta di atas, atau pilih cepat wilayah contoh di bawah:</p>
                <div className="auto-quick-picks">
                  {[
                    { nama: "Antang", depth: 85 },
                    { nama: "Mariso", depth: 50 },
                    { nama: "Tallo", depth: 65 },
                    { nama: "Panakkukang", depth: 40 },
                  ].map((item) => (
                    <button
                      key={item.nama}
                      type="button"
                      className="quick-pick-btn"
                      onClick={() => {
                        if (onSelectKelurahanQuick) {
                          onSelectKelurahanQuick(item.nama);
                        } else {
                          setCustomDepth(item.depth);
                          setSimulatorMode("custom");
                        }
                      }}
                    >
                      {item.nama} (~{item.depth} cm)
                    </button>
                  ))}
                  <button
                    type="button"
                    className="quick-pick-btn switch-custom"
                    onClick={() => setSimulatorMode("custom")}
                  >
                    Atur Manual (Mode Kustom) &rarr;
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PANEL 2: KONTROL SLIDER MODE KUSTOM MANDIRI */}
      {simulatorMode === "custom" && (
        <div className="simulator-control-panel">
          <div className="slider-label-row">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <label htmlFor="depth-slider" className="slider-label">
                Geser Ketinggian Air Bebas:
              </label>
              <span className="custom-mode-badge">Bebas Disesuaikan</span>
            </div>

            <div className="slider-value-display">
              <strong className="slider-value-cm">{customDepth} cm</strong>
              <span className="slider-value-m">({(customDepth / 100).toFixed(2)} meter)</span>
            </div>
          </div>

          <input
            id="depth-slider"
            type="range"
            min="0"
            max="200"
            step="5"
            value={customDepth}
            onChange={(e) => setCustomDepth(Number(e.target.value))}
            className="depth-range-slider"
            aria-label="Atur ketinggian simulasi banjir dalam sentimeter"
          />

          <div className="slider-ticks">
            <span>0 cm (Kering)</span>
            <span>50 cm (Selutut)</span>
            <span>100 cm (Sepinggang)</span>
            <span>150 cm (Sedada)</span>
            <span>200 cm (Kritis)</span>
          </div>

          {/* Tombol Preset Cepat */}
          <div className="simulator-presets-row">
            <span className="presets-label">Pilihan Preset Cepat:</span>
            <div className="presets-buttons">
              {PRESETS.map((p) => (
                <button
                  key={`preset-${p.value}`}
                  type="button"
                  className={`preset-chip ${customDepth === p.value ? "active" : ""}`}
                  onClick={() => setCustomDepth(p.value)}
                  title={p.desc}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Visualisasi Skala Manusia dengan Nilai Aktif */}
      <div className="simulator-vis-wrapper">
        <FloodDepthVisualization depthCm={activeDepth} isSimulation={true} showImpactCards={true} />
      </div>

      {/* Catatan Keselamatan Edukasi */}
      <div className="simulator-footer-note">
        <IconAlertTriangle size={15} color="#64748B" />
        <p>
          <strong>Prinsip Keselamatan Umum:</strong> Selalu hindari berjalan atau berkendara menembus genangan banjir
          apapun ketinggiannya jika terdapat arus air deras. Lubang jalan, parit terbuka, dan kabel listrik bertegangan
          dapat membahayakan keselamatan jiwa.
        </p>
      </div>
    </div>
  );
}
