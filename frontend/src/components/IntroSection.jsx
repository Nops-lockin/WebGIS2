import React from "react";
import { IconDirections, IconShield } from "../Icons";

export default function IntroSection({ summary = { rendah: 0, sedang: 0, tinggi: 0, sangat_tinggi: 0, total: 153 } }) {
  const scrollToMap = () => {
    const el = document.getElementById("peta");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="intro-section">
      <div className="intro-container">
        <div className="intro-content">
          <div className="intro-badge">
            <IconShield size={14} color="#176B65" />
            <span>Platform Edukasi & Kesiapsiagaan Publik Kota Makassar</span>
          </div>

          <h1 className="intro-title">Kenali Risiko Banjir di Sekitarmu</h1>

          <p className="intro-subtitle">
            Jelajahi informasi risiko banjir, prakiraan hujan, dan panduan kesiapsiagaan di Kota Makassar.
            Bukan sekadar melihat warna peta, namun memahami arti risiko dan langkah nyata untuk bersiap.
          </p>

          <div className="intro-cta-row">
            <button type="button" onClick={scrollToMap} className="intro-primary-btn">
              <IconDirections size={18} color="#FFFFFF" />
              <span>Jelajahi Peta Banjir</span>
            </button>
            <a href="#panduan" className="intro-secondary-btn">
              <span>Lihat Langkah Aman</span>
            </a>
          </div>
        </div>

        {/* Ringkasan Status 153 Kelurahan Real-Time */}
        <div className="intro-stats-cards">
          <div className="stat-pill stat-aman">
            <span className="stat-dot" style={{ backgroundColor: "#2F855A" }} />
            <div className="stat-info">
              <span className="stat-label">Aman (Data Tersedia)</span>
              <strong className="stat-num">{summary.rendah} Kelurahan</strong>
            </div>
          </div>

          <div className="stat-pill stat-waspada">
            <span className="stat-dot" style={{ backgroundColor: "#D69E2E" }} />
            <div className="stat-info">
              <span className="stat-label">Waspada</span>
              <strong className="stat-num">{summary.sedang} Kelurahan</strong>
            </div>
          </div>

          <div className="stat-pill stat-siaga">
            <span className="stat-dot" style={{ backgroundColor: "#DD6B20" }} />
            <div className="stat-info">
              <span className="stat-label">Siaga Banjir</span>
              <strong className="stat-num">{summary.tinggi} Kelurahan</strong>
            </div>
          </div>

          <div className="stat-pill stat-bahaya">
            <span className="stat-dot" style={{ backgroundColor: "#C53030" }} />
            <div className="stat-info">
              <span className="stat-label">Bahaya Ekstrem</span>
              <strong className="stat-num">{summary.sangat_tinggi} Kelurahan</strong>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
