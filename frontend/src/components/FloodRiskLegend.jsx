import React from "react";

export default function FloodRiskLegend({ summary = { rendah: 0, sedang: 0, tinggi: 0, sangat_tinggi: 0 } }) {
  return (
    <div className="flood-map-legend" role="complementary" aria-label="Legenda Tingkat Risiko Banjir">
      <div className="legend-header">
        <strong>Tingkat Risiko Banjir</strong>
      </div>

      <div className="legend-items">
        <div className="legend-item">
          <span className="legend-color-box" style={{ backgroundColor: "#2F855A" }} />
          <span className="legend-text">Aman (Data Tersedia)</span>
          <span className="legend-count">({summary.rendah})</span>
        </div>

        <div className="legend-item">
          <span className="legend-color-box" style={{ backgroundColor: "#D69E2E" }} />
          <span className="legend-text">Waspada</span>
          <span className="legend-count">({summary.sedang})</span>
        </div>

        <div className="legend-item">
          <span className="legend-color-box" style={{ backgroundColor: "#DD6B20" }} />
          <span className="legend-text">Siaga Banjir</span>
          <span className="legend-count">({summary.tinggi})</span>
        </div>

        <div className="legend-item">
          <span className="legend-color-box" style={{ backgroundColor: "#C53030" }} />
          <span className="legend-text">Bahaya Ekstrem</span>
          <span className="legend-count">({summary.sangat_tinggi})</span>
        </div>
      </div>
    </div>
  );
}
