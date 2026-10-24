import React from "react";
import { IconRoute, IconClose, IconPhone, IconShield } from "../Icons";

export default function EvacuationRouteCard({
  routeData,
  originName,
  targetPosko,
  onClose,
  isSimulation,
}) {
  if (!routeData || !targetPosko) return null;

  return (
    <div className="route-nav-card" role="region" aria-label="Panduan Rute Evakuasi Teraman">
      {/* Header Rute */}
      <div className="route-card-header">
        <div className="route-header-info">
          <div className="route-icon-badge">
            <IconRoute size={18} color="#FFFFFF" />
          </div>
          <div>
            <div className="route-eyebrow">
              {isSimulation ? "🧪 SKENARIO EVAKUASI SIMULASI" : "JALUR EVAKUASI TERVERIFIKASI"}
            </div>
            <h4 className="route-title">Rute Menuju: {targetPosko.nama}</h4>
          </div>
        </div>

        <button
          type="button"
          className="route-close-btn"
          onClick={onClose}
          aria-label="Tutup panduan rute evakuasi"
        >
          <IconClose size={16} color="#64748B" />
        </button>
      </div>

      {/* Ringkasan Asal & Tujuan */}
      <div className="route-origin-target-box">
        <div className="route-point">
          <span className="point-dot origin" />
          <div className="point-text">
            <span className="point-label">TITIK AWAL:</span>
            <strong>{originName || "Posisi Perangkat Anda"}</strong>
          </div>
        </div>
        <div className="route-connector-line" />
        <div className="route-point">
          <span className="point-dot target" />
          <div className="point-text">
            <span className="point-label">TUJUAN EVAKUASI:</span>
            <strong>{targetPosko.nama} ({targetPosko.alamat})</strong>
          </div>
        </div>
      </div>

      {/* Metrik Waktu & Jarak */}
      <div className="route-stats-grid">
        <div className="route-stat-box">
          <span className="r-label">JARAK TEMPUH</span>
          <strong className="r-val">{routeData.jarakKm} km</strong>
          <span className="r-sub">Jalur Jalan Raya</span>
        </div>
        <div className="route-stat-box">
          <span className="r-label">KENDARAAN</span>
          <strong className="r-val" style={{ color: "#16A34A" }}>
            ±{routeData.waktuKendaraanMenit} mnt
          </strong>
          <span className="r-sub">Kecepatan Darurat</span>
        </div>
        <div className="route-stat-box">
          <span className="r-label">JALAN KAKI</span>
          <strong className="r-val" style={{ color: "#D97706" }}>
            ±{routeData.waktuJalanKakiMenit} mnt
          </strong>
          <span className="r-sub">4 km/jam</span>
        </div>
      </div>

      {/* Rekomendasi Keselamatan Jalur */}
      <div className="route-advisories-box">
        <div className="advisory-title-row">
          <IconShield size={14} color="#176B65" />
          <strong>Rekomendasi Jalur Aman:</strong>
        </div>
        <ul className="advisory-list">
          {routeData.advisories.map((adv, idx) => (
            <li key={`adv-${idx}`}>{adv}</li>
          ))}
        </ul>
      </div>

      {/* Tombol Tindakan */}
      <div className="route-actions-row">
        <a
          href={routeData.googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="route-btn-gmaps"
        >
          🗺️ Buka Navigasi Suara Google Maps
        </a>
        <a
          href={`tel:${targetPosko.kontak.replace(/[^0-9]/g, "") || "112"}`}
          className="route-btn-call"
        >
          <IconPhone size={14} color="#FFFFFF" />
          <span>Hubungi Posko</span>
        </a>
      </div>
    </div>
  );
}
