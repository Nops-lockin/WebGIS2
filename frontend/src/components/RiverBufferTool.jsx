import React from "react";
import { IconTarget, IconInfo } from "../Icons";
import { KANAL_DAN_SUNGAI_MAKASSAR } from "../data/evakuasiDanKanal";

// Pemetaan kelurahan di sekitar sempadan kanal utama Makassar
export const KELURAHAN_SEMPADAN_KANAL = {
  "sungai-jeneberang": [
    { nama: "Barombong", kec: "Tamalate", jarak: "±50 m dari tanggul", risiko: "Tinggi" },
    { nama: "Tanjung Merdeka", kec: "Tamalate", jarak: "±80 m dari muara", risiko: "Sangat Tinggi" },
    { nama: "Maccini Sombala", kec: "Tamalate", jarak: "±120 m dari bantaran", risiko: "Tinggi" },
    { nama: "Parang Tambung", kec: "Tamalate", jarak: "±150 m dari hilir", risiko: "Sedang" },
  ],
  "sungai-tallo": [
    { nama: "Tallo", kec: "Tallo", jarak: "±40 m dari bibir muara", risiko: "Bahaya Ekstrem" },
    { nama: "Buloa", kec: "Tallo", jarak: "±75 m dari sempadan", risiko: "Sangat Tinggi" },
    { nama: "Rappokalling", kec: "Tallo", jarak: "±110 m dari sungai", risiko: "Tinggi" },
    { nama: "Lakkang", kec: "Tallo", jarak: "Pulau delta di tengah sungai", risiko: "Sangat Tinggi" },
    { nama: "Tamalanrea Jaya", kec: "Tamalanrea", jarak: "±180 m dari bantaran", risiko: "Sedang" },
  ],
  "kanal-jongaya": [
    { nama: "Pa'baeng-baeng", kec: "Tamalate", jarak: "±60 m dari kanal", risiko: "Tinggi" },
    { nama: "Jongaya", kec: "Tamalate", jarak: "±45 m dari tanggul", risiko: "Tinggi" },
    { nama: "Bongaya", kec: "Tamalate", jarak: "±80 m dari kanal", risiko: "Sedang" },
    { nama: "Mariso", kec: "Mariso", jarak: "±90 m dari muara kanal", risiko: "Sangat Tinggi" },
    { nama: "Mattoanging", kec: "Mariso", jarak: "±100 m dari kanal", risiko: "Tinggi" },
  ],
  "kanal-panampu": [
    { nama: "Pannampu", kec: "Tallo", jarak: "±30 m dari bantaran", risiko: "Bahaya Ekstrem" },
    { nama: "Lembo", kec: "Tallo", jarak: "±50 m dari kanal", risiko: "Sangat Tinggi" },
    { nama: "Kaluku Bodoa", kec: "Tallo", jarak: "±70 m dari kanal", risiko: "Sangat Tinggi" },
    { nama: "Rappojawa", kec: "Tallo", jarak: "±90 m dari saluran", risiko: "Tinggi" },
    { nama: "Bunga Eja Beru", kec: "Tallo", jarak: "±120 m dari kanal", risiko: "Tinggi" },
  ],
  "kanal-sinrijala": [
    { nama: "Sinrijala", kec: "Panakkukang", jarak: "±40 m dari saluran", risiko: "Tinggi" },
    { nama: "Tamamaung", kec: "Panakkukang", jarak: "±85 m dari kanal", risiko: "Tinggi" },
    { nama: "Karampuang", kec: "Panakkukang", jarak: "±120 m dari tanggul", risiko: "Sedang" },
  ],
  "saluran-pampang": [
    { nama: "Pampang", kec: "Panakkukang", jarak: "±50 m dari saluran", risiko: "Sangat Tinggi" },
    { nama: "Antang", kec: "Manggala", jarak: "±90 m dari hulu saluran", risiko: "Bahaya Ekstrem" },
    { nama: "Borong", kec: "Manggala", jarak: "±130 m dari saluran", risiko: "Tinggi" },
  ],
};

export default function RiverBufferTool({
  selectedRiverId,
  onSelectRiver,
  bufferRadius,
  onChangeRadius,
  onHighlightKelurahan,
}) {
  const rivers = KANAL_DAN_SUNGAI_MAKASSAR.features;
  const currentRiver = rivers.find((r) => r.properties.id === selectedRiverId) || rivers[0];
  const impactedList = KELURAHAN_SEMPADAN_KANAL[currentRiver.properties.id] || [];

  return (
    <div className="buffer-tool-card" role="region" aria-label="Analisis Radius Sempadan Kanal">
      <div className="buffer-card-header">
        <div className="buffer-header-title">
          <div className="buffer-icon-wrap">
            <IconTarget size={18} color="#EA580C" />
          </div>
          <div>
            <span className="buffer-eyebrow">ANALISIS SPASIAL GEOPROCESSING</span>
            <h4 className="buffer-title">Radius Bahaya Luapan Sungai & Kanal</h4>
          </div>
        </div>
      </div>

      {/* Pilihan Kanal/Sungai */}
      <div className="buffer-select-row">
        <label htmlFor="river-picker" className="buffer-label">Pilih Saluran / Kanal:</label>
        <select
          id="river-picker"
          className="buffer-select-dropdown"
          value={currentRiver.properties.id}
          onChange={(e) => onSelectRiver(e.target.value)}
        >
          {rivers.map((r) => (
            <option key={r.properties.id} value={r.properties.id}>
              {r.properties.nama} ({r.properties.jenis})
            </option>
          ))}
        </select>
      </div>

      {/* Pilihan Radius Buffer Sempadan */}
      <div className="buffer-radius-selector">
        <span className="buffer-label">Radius Jarak Bahaya Luapan:</span>
        <div className="radius-chips-row">
          {[100, 250, 500].map((r) => (
            <button
              key={`rad-${r}`}
              type="button"
              className={`radius-chip ${bufferRadius === r ? "active" : ""}`}
              onClick={() => onChangeRadius(r)}
            >
              {r} Meter
            </button>
          ))}
        </div>
      </div>

      {/* Statistik Dampak Sempadan */}
      <div className="buffer-impact-summary">
        <div className="impact-summary-header">
          <strong>⚠️ {impactedList.length} Kelurahan Masuk Zona Sempadan ({bufferRadius}m):</strong>
          <span className="impact-sub">Muara: {currentRiver.properties.muara}</span>
        </div>

        <div className="impact-kelurahan-list">
          {impactedList.map((kel, idx) => (
            <div
              key={`imp-${idx}`}
              className="impact-item-row"
              onClick={() => {
                if (onHighlightKelurahan) onHighlightKelurahan(kel.nama);
              }}
              title="Klik untuk menyorot kelurahan di peta"
            >
              <div className="impact-item-main">
                <span className="impact-name">{kel.nama}</span>
                <span className="impact-kec">Kec. {kel.kec} &bull; {kel.jarak}</span>
              </div>
              <span
                className="impact-badge"
                style={{
                  backgroundColor: kel.risiko.includes("Ekstrem") || kel.risiko.includes("Sangat") ? "#FEE2E2" : "#FEF3C7",
                  color: kel.risiko.includes("Ekstrem") || kel.risiko.includes("Sangat") ? "#DC2626" : "#D97706",
                }}
              >
                {kel.risiko}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="buffer-hint-box">
        <IconInfo size={14} color="#64748B" />
        <span>
          Garis sabuk bahaya ({bufferRadius}m) digambar di atas peta Leaflet sepanjang aliran {currentRiver.properties.nama}.
        </span>
      </div>
    </div>
  );
}
