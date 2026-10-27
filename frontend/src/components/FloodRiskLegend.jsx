import React, { useState } from "react";

export default function FloodRiskLegend({ summary = { rendah: 0, sedang: 0, tinggi: 0, sangat_tinggi: 0 } }) {
  // Pada layar mobile (lebar <= 768px), default-kan terlipat (collapsed) agar peta bersih
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth <= 768;
    }
    return false;
  });

  return (
    <div
      className={`flood-map-legend ${collapsed ? "legend-collapsed" : ""}`}
      role="complementary"
      aria-label="Legenda Peta WebGIS"
    >
      <div
        className="legend-header"
        onClick={() => setCollapsed(!collapsed)}
        style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}
        title="Klik untuk menyembunyikan/menampilkan legenda"
      >
        <strong>Legenda Peta</strong>
        <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "8px" }}>
          {collapsed ? "▲ Buka" : "▼ Tutup"}
        </span>
      </div>

      {!collapsed && (
        <div className="legend-body-content">
          <div className="legend-section" style={{ marginTop: "6px" }}>
            <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>
              Tingkat Kerawanan
            </span>
            <div className="legend-items">
              <div className="legend-item">
                <span className="legend-color-box" style={{ backgroundColor: "#10B981" }} />
                <span className="legend-text">Aman</span>
                <span className="legend-count">({summary.rendah})</span>
              </div>

              <div className="legend-item">
                <span className="legend-color-box" style={{ backgroundColor: "#F59E0B" }} />
                <span className="legend-text">Waspada</span>
                <span className="legend-count">({summary.sedang})</span>
              </div>

              <div className="legend-item">
                <span className="legend-color-box" style={{ backgroundColor: "#F97316" }} />
                <span className="legend-text">Siaga Banjir</span>
                <span className="legend-count">({summary.tinggi})</span>
              </div>

              <div className="legend-item">
                <span className="legend-color-box" style={{ backgroundColor: "#EF4444" }} />
                <span className="legend-text">Bahaya</span>
                <span className="legend-count">({summary.sangat_tinggi})</span>
              </div>
            </div>
          </div>

          <div className="legend-divider" />

          {/* Legenda Titik Posko & Fasilitas Kritis */}
          <div className="legend-section">
            <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>
              Simbol & Fasilitas
            </span>
            <div className="legend-items">
              <div className="legend-item">
                <span className="legend-icon-badge" style={{ backgroundColor: "#16A34A" }}>⛺</span>
                <span className="legend-text">Posko Pengungsian</span>
              </div>

              <div className="legend-item">
                <span className="legend-icon-badge" style={{ backgroundColor: "#DC2626" }}>🏥</span>
                <span className="legend-text">Rumah Sakit / Faskes</span>
              </div>

              <div className="legend-item">
                <span className="legend-icon-badge" style={{ backgroundColor: "#EA580C" }}>🚒</span>
                <span className="legend-text">BPBD & Damkar</span>
              </div>

              <div className="legend-item">
                <span className="legend-icon-badge" style={{ backgroundColor: "#0284C7" }}>⛽</span>
                <span className="legend-text">SPBU Siaga</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
