import React, { useState } from "react";
import { IconCloudRain, IconInfo } from "../Icons";

export default function RainfallInsight({
  prakiraanList = [],
  selectedKelurahan = null,
  hujanTerbaru = 0,
}) {
  const [selectedInterval, setSelectedInterval] = useState(0);

  // Data prakiraan default atau dari prop
  const items = prakiraanList.length > 0 ? prakiraanList.slice(0, 8) : [];
  const current = items[selectedInterval] || items[0] || null;

  return (
    <section id="cuaca" className="rainfall-insight-section">
      <div className="section-container">
        <div className="section-header-block">
          <div className="section-badge">
            <IconCloudRain size={16} color="#176B65" />
            <span>Prakiraan Cuaca & Dinamika Hujan BMKG</span>
          </div>
          <h2 className="section-title">Prakiraan Cuaca & Potensi Hujan di Makassar</h2>
          <p className="section-subtitle">
            Pantau proyeksi cuaca 3 harian untuk mengantisipasi potensi genangan sebelum hujan deras turun.
            {selectedKelurahan && ` Menampilkan proyeksi untuk wilayah: ${selectedKelurahan.nama_kelurahan}.`}
          </p>
        </div>

        {/* Highlight Card Cuaca Terkini / Interval Terpilih */}
        {current ? (
          <div className="rainfall-current-card">
            <div className="current-card-main">
              <div className="current-weather-badge">
                <span className="current-weather-icon">
                  {current.kondisi?.toLowerCase().includes("hujan lebat")
                    ? "⛈️"
                    : current.kondisi?.toLowerCase().includes("hujan")
                    ? "🌧️"
                    : current.kondisi?.toLowerCase().includes("cerah")
                    ? "☀️"
                    : "⛅"}
                </span>
                <div>
                  <span className="current-condition-label">{current.kondisi || "Cerah Berawan"}</span>
                  <div className="current-temp-row">
                    <strong className="current-temp-val">{current.suhu_c != null ? `${current.suhu_c}°C` : "30°C"}</strong>
                    <span className="current-location-tag">
                      {selectedKelurahan ? selectedKelurahan.nama_kelurahan : "Kota Makassar"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="current-meta-grid">
                <div className="meta-box">
                  <span className="meta-label">KELEMBAPAN UDARA</span>
                  <strong className="meta-val">{current.kelembapan_persen != null ? `${current.kelembapan_persen}%` : "65%"}</strong>
                </div>

                <div className="meta-box">
                  <span className="meta-label">STATUS HUJAN HARI INI</span>
                  <strong className="meta-val">{hujanTerbaru > 0 ? `${hujanTerbaru} mm (Ada Hujan)` : "0 mm (Kering)"}</strong>
                </div>

                <div className="meta-box">
                  <span className="meta-label">WAKTU PROYEKSI</span>
                  <strong className="meta-val">{current.waktu_lokal || "Hari ini"}</strong>
                </div>
              </div>
            </div>

            {/* Timeline Interaktif Interval Waktu 3 Jam */}
            <div className="rainfall-timeline-wrapper">
              <span className="timeline-title">Pilih Waktu Prakiraan (Interval 3 Jam):</span>
              <div className="timeline-slots">
                {items.map((it, idx) => {
                  const isAct = idx === selectedInterval;
                  const timeStr = it.waktu_lokal ? it.waktu_lokal.split(" ")[1]?.slice(0, 5) : `+${idx * 3}j`;
                  const dateStr = it.waktu_lokal ? it.waktu_lokal.split(" ")[0]?.slice(5) : "";
                  const isRain = it.kondisi?.toLowerCase().includes("hujan");

                  return (
                    <button
                      key={`slot-${idx}`}
                      type="button"
                      className={`timeline-slot-btn ${isAct ? "active" : ""} ${isRain ? "slot-rain" : ""}`}
                      onClick={() => setSelectedInterval(idx)}
                    >
                      <span className="slot-date">{dateStr}</span>
                      <strong className="slot-time">{timeStr}</strong>
                      <span className="slot-icon">
                        {isRain ? "🌧️" : it.kondisi?.toLowerCase().includes("cerah") ? "☀️" : "⛅"}
                      </span>
                      <span className="slot-temp">{it.suhu_c != null ? `${it.suhu_c}°` : "-"}</span>
                      <span className="slot-status">{it.kondisi || "Berawan"}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="rainfall-fallback-card">
            <p>Memuat prakiraan cuaca BMKG...</p>
          </div>
        )}

        {/* Klasifikasi Ambang Batas Curah Hujan BMKG (Standar Resmi) */}
        <div className="rainfall-thresholds-grid">
          <div className="threshold-card border-aman">
            <div className="threshold-badge" style={{ backgroundColor: "#2F855A" }}>
              Hujan Ringan
            </div>
            <strong>0.5 – 20 mm / hari</strong>
            <p>Genangan jarang terjadi. Drainase kota berfungsi lancar tanpa hambatan berarti.</p>
          </div>

          <div className="threshold-card border-waspada">
            <div className="threshold-badge" style={{ backgroundColor: "#D69E2E" }}>
              Hujan Sedang
            </div>
            <strong>20 – 50 mm / hari</strong>
            <p>Potensi genangan air di jalan raya dan cekungan lokal berdurasi 30-60 menit.</p>
          </div>

          <div className="threshold-card border-siaga">
            <div className="threshold-badge" style={{ backgroundColor: "#DD6B20" }}>
              Hujan Lebat
            </div>
            <strong>50 – 100 mm / hari</strong>
            <p>Saluran air meluap. Waspada banjir di kawasan permukiman dataran rendah Makassar.</p>
          </div>

          <div className="threshold-card border-bahaya">
            <div className="threshold-badge" style={{ backgroundColor: "#C53030" }}>
              Hujan Sangat Lebat
            </div>
            <strong>&gt; 100 mm / hari</strong>
            <p>Banjir meluas dan risiko luapan kanal utama (Jeneberang, Tallo). Siaga evakuasi warga.</p>
          </div>
        </div>

        {/* Catatan Transparansi Data Cuaca */}
        <div className="rainfall-disclaimer-box">
          <IconInfo size={16} color="#64748B" />
          <p>
            <strong>Catatan Integritas Data BMKG:</strong> Data cuaca di atas merupakan <em>prakiraan cuaca numerik</em>{" "}
            dari Badan Meteorologi, Klimatologi, dan Geofisika (BMKG). Nilai prakiraan dapat berubah sesuai dinamika
            atmosfer dan bukan merupakan pengukuran akumulasi hujan aktual yang telah terjadi di lapangan.
          </p>
        </div>
      </div>
    </section>
  );
}
