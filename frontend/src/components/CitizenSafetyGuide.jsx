import React, { useState } from "react";
import { IconShield, IconCompass, IconTarget, IconInfo } from "../Icons";

const GUIDE_PHASES = [
  {
    id: "siaga",
    phase: "FASE 1: SAAT HUJAN LEBAT",
    title: "Kesiapsiagaan Dini",
    badge: "Waspada",
    badgeColor: "#F59E0B",
    icon: "🌧️",
    steps: [
      {
        no: "1",
        title: "Cek Status Wilayah & Elevasi",
        desc: "Buka kelurahan Anda pada peta WebGIS JeneBosi untuk melihat tingkat kerawanan dan potensi genangan.",
        action: "Gunakan fitur cari kelurahan di bar atas",
      },
      {
        no: "2",
        title: "Simpan Barang Berharga & Berkas",
        desc: "Pindahkan berkas ijazah, sertifikat, dan alat elektronik ke lantai atas atau tempat minimal 1 meter dari lantai.",
        action: "Bungkus dalam plastik kedap air",
      },
      {
        no: "3",
        title: "Pantau Saluran Drainase",
        desc: "Pastikan selokan depan rumah tidak tersumbat sampah. Hindari membuang limbah saat debit air meninggi.",
        action: "Jaga saluran air tetap mengalir",
      },
    ],
  },
  {
    id: "banjir",
    phase: "FASE 2: SAAT AIR MULAI NAIK",
    title: "Tanggap Darurat Air Meluap",
    badge: "Siaga & Bahaya",
    badgeColor: "#EF4444",
    icon: "🌊",
    steps: [
      {
        no: "1",
        title: "Matikan Meteran Listrik & Gas",
        desc: "Segera putuskan aliran listrik dari MCB utama dan cabut regulator tabung gas untuk mencegah korsleting dan kebakaran.",
        action: "Wajib dilakukan sebelum air menyentuh stop kontak",
      },
      {
        no: "2",
        title: "Amankan Lansia, Balita & Hewan",
        desc: "Prioritaskan evakuasi anggota keluarga rentan menuju tempat yang lebih tinggi sebelum jalur jalan terputus genangan deras.",
        action: "Siapkan tas siaga bencana (pakaian, obat pribadi)",
      },
      {
        no: "3",
        title: "Hindari Melintasi Arus Deras",
        desc: "Jangan berjalan atau mengendarai motor di genangan yang arusnya tak terlihat karena kedalaman saluran drainase tidak terduga.",
        action: "Gunakan tongkat/kayu untuk meraba jalan",
      },
    ],
  },
  {
    id: "evakuasi",
    phase: "FASE 3: EVAKUASI & BANTUAN",
    title: "Menuju Tempat Pengungsian",
    badge: "Aksi Lapangan",
    badgeColor: "#10B981",
    icon: "⛺",
    steps: [
      {
        no: "1",
        title: "Cek Titik Posko Evakuasi Terdekat",
        desc: "Buka tab 'Posko Evakuasi' di WebGIS untuk melihat 30 lokasi posko pengungsian resmi Pemkot Makassar beserta kapasitasnya.",
        action: "Fokuskan peta ke posko terdekat",
      },
      {
        no: "2",
        title: "Hubungi Call Center 112 (Bebas Pulsa)",
        desc: "Layanan darurat terpadu Kota Makassar siaga 24 jam untuk evakuasi perahu karet BPBD, medis darurat, dan armada Damkar.",
        action: "Tekan tombol darurat 112 di bawah",
      },
      {
        no: "3",
        title: "Lapor RT/RW & Ikuti Arahan Petugas",
        desc: "Saat tiba di titik kumpul/posko, daftarkan seluruh anggota keluarga ke petugas posko agar pendataan logistik akurat.",
        action: "Tetap berada di zona aman sampai air surut",
      },
    ],
  },
];

export default function CitizenSafetyGuide() {
  const [activeTab, setActiveTab] = useState("siaga");
  const current = GUIDE_PHASES.find((p) => p.id === activeTab) || GUIDE_PHASES[0];

  return (
    <div className="interactive-guide-wrapper">
      {/* Header Pengantar */}
      <div className="guide-hero-banner">
        <div className="guide-hero-badge">
          <IconShield size={14} color="#38BDF8" />
          <span>STANDAR OPERASIONAL MITIGASI WARGA</span>
        </div>
        <h3 className="guide-hero-title">Panduan Cepat Tanggap Darurat Banjir</h3>
        <p className="guide-hero-subtitle">
          Protokol keselamatan resmi bagi masyarakat Kota Makassar dalam menghadapi cuaca ekstrem dan luapan air.
        </p>
      </div>

      {/* Tab Navigasi Fase Interaktif */}
      <div className="guide-phase-tabs">
        {GUIDE_PHASES.map((phase) => (
          <button
            key={phase.id}
            type="button"
            className={`guide-phase-btn ${activeTab === phase.id ? "active" : ""}`}
            onClick={() => setActiveTab(phase.id)}
          >
            <span className="phase-icon">{phase.icon}</span>
            <div className="phase-text-col">
              <span className="phase-eyebrow">{phase.phase}</span>
              <strong className="phase-label">{phase.title}</strong>
            </div>
          </button>
        ))}
      </div>

      {/* Kartu Langkah Langkah Interaktif */}
      <div className="guide-cards-container">
        <div className="guide-step-card-header">
          <div>
            <span
              className="guide-status-chip"
              style={{
                backgroundColor: `${current.badgeColor}22`,
                color: current.badgeColor,
                borderColor: `${current.badgeColor}55`,
              }}
            >
              ● Status: {current.badge}
            </span>
            <h4 className="guide-step-card-title">{current.title}</h4>
          </div>
          <span className="guide-step-count">{current.steps.length} Langkah Penting</span>
        </div>

        <div className="guide-steps-vertical-list">
          {current.steps.map((st) => (
            <div key={st.no} className="interactive-step-item">
              <div className="step-circle-badge">{st.no}</div>
              <div className="step-details-col">
                <strong className="step-title-txt">{st.title}</strong>
                <p className="step-desc-txt">{st.desc}</p>
                <div className="step-action-tag">
                  <span className="tag-icon">⚡</span>
                  <span>Tindakan: {st.action}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Emergency Action Buttons Row */}
      <div className="guide-emergency-callout">
        <div className="callout-text-info">
          <strong className="callout-title">Butuh Evakuasi Darurat atau Ambulans?</strong>
          <span className="callout-sub">Petugas BPBD dan Damkar Makassar siaga 24 jam bebas pulsa.</span>
        </div>
        <div className="callout-action-group">
          <a href="tel:112" className="guide-call-112-btn">
            📞 Hubungi Call Center 112
          </a>
          <a
            href="https://api.whatsapp.com/send?phone=62811414112&text=Halo%20BPBD%20Makassar,%20saya%20butuh%20bantuan%20evakuasi%20banjir"
            target="_blank"
            rel="noopener noreferrer"
            className="guide-wa-bpbd-btn"
          >
            💬 WhatsApp BPBD
          </a>
        </div>
      </div>
    </div>
  );
}
