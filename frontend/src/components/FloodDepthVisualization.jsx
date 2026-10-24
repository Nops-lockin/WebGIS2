import React from "react";
import { IconAlertTriangle } from "../Icons";

/**
 * Interpretasi dampak kedalaman air pada berbagai entitas:
 * - Pejalan Kaki
 * - Anak-Anak
 * - Sepeda Motor
 * - Mobil
 */
export function getDepthImpact(depthCm) {
  if (depthCm <= 0) {
    return {
      severity: "aman",
      label: "Kering / Tidak Ada Genangan",
      badgeColor: "#2F855A",
      bgBadge: "rgba(47, 133, 90, 0.12)",
      pedestrian: "Aman dilalui berjalan kaki secara normal.",
      children: "Kondisi jalan kering dan aman bagi anak-anak.",
      motorcycle: "Aman untuk segala jenis kendaraan roda dua.",
      car: "Aman untuk seluruh kendaraan roda empat.",
      advice: "Pertahankan kewaspadaan cuaca terkini dari BMKG.",
    };
  }

  if (depthCm <= 15) {
    return {
      severity: "rendah",
      label: "Genangan Dangkal (Semata Kaki)",
      badgeColor: "#2F855A",
      bgBadge: "rgba(47, 133, 90, 0.15)",
      pedestrian: "Dapat dilalui pejalan kaki dewasa dengan alas kaki tahan air.",
      children: "Anak-anak mulai berisiko terpeleset pada lubang atau trotoar tersembunyi.",
      motorcycle: "Dapat dilalui dengan kecepatan rendah, waspadai jalan berlubang.",
      car: "Aman dilalui semua jenis mobil.",
      advice: "Waspadai selokan tertutup dan lubang jalan yang tidak terlihat.",
    };
  }

  if (depthCm <= 35) {
    return {
      severity: "waspada",
      label: "Genangan Sedang (Sebetis Dewasa / Selutut Anak)",
      badgeColor: "#D69E2E",
      bgBadge: "rgba(214, 158, 46, 0.15)",
      pedestrian: "Langkah kaki terasa berat akibat tekanan air. Hindari berjalan melawan arus.",
      children: "Tinggi air mencapai lutut anak. Anak kecil dapat terseret jika arus mengalir.",
      motorcycle: "Batas aman knalpot motor matic/bebek. Berisiko mesin mati mendadak.",
      car: "Mobil sedan mulai berisiko terkena cipratan ruang mesin. SUV/truk masih aman.",
      advice: "Jangan izinkan anak bermain di dekat genangan atau saluran drainase.",
    };
  }

  if (depthCm <= 60) {
    return {
      severity: "tinggi",
      label: "Genangan Tinggi (Selutut Dewasa / Sepinggang Anak)",
      badgeColor: "#DD6B20",
      bgBadge: "rgba(221, 107, 32, 0.15)",
      pedestrian: "Sangat berbahaya dilalui pejalan kaki. Tekanan arus air dapat merobohkan orang dewasa.",
      children: "BAHAYA KRITIS! Air mencapai pinggang/dada anak. Risiko fatal terseret arus sangat tinggi.",
      motorcycle: "JANGAN DILALUI! Air dipastikan masuk ke knalpot, saringan udara, dan mesin motor.",
      car: "Mobil sedan dan hatchback akan mogok/terapung. Hanya SUV tinggi yang dapat bergerak hati-hati.",
      advice: "Matikan aliran listrik rumah tangga dan siapkan tas siaga bencana.",
    };
  }

  if (depthCm <= 100) {
    return {
      severity: "ekstrem",
      label: "Banjir Serius (Sepinggang Dewasa / Menenggelamkan Anak)",
      badgeColor: "#C53030",
      bgBadge: "rgba(197, 48, 48, 0.15)",
      pedestrian: "TIDAK BISA DILALUI DENGAN BERJALAN KAKI. Arus air dapat menghanyutkan orang dewasa.",
      children: "BAHAYA TENGGELAM! Anak-anak mutlak harus dievakuasi ke tempat tinggi / lantai 2.",
      motorcycle: "TERENDAM TOTAL. Segera evakuasi ke tempat yang lebih tinggi.",
      car: "Semua mobil penumpang akan terapung dan hanyut oleh arus air.",
      advice: "Segera lakukan evakuasi mandiri ke posko pengungsian atau hubungi Call Center 112.",
    };
  }

  return {
    severity: "bencana",
    label: "Banjir Ekstrem / Bandang (Sedada Dewasa ke Atas)",
    badgeColor: "#7F1D1D",
    bgBadge: "rgba(127, 29, 29, 0.2)",
    pedestrian: "ANCAAMAN KESELAMATAN JIWA. Pejalan kaki dipastikan hanyut oleh arus deras.",
    children: "KONDISI KRITIS FATAL. Hanya dapat diselamatkan dengan perahu karet tim SAR.",
    motorcycle: "Terendam penuh dan hanyut terbawa arus.",
    car: "Kendaraan hanyut dan dapat menabrak bangunan di sekitarnya.",
    advice: "Bertahan di atap atau tempat tertinggi dan hubungi Basarnas / BPBD Makassar.",
  };
}

/**
 * Komponen Visualisasi Skala Manusia (Adult ~170cm vs Child ~110cm)
 * Menggunakan SVG dengan garis air bersama (shared ground level & vertical ruler scale).
 */
export default function FloodDepthVisualization({
  depthCm = 0,
  isSimulation = false,
  showImpactCards = true,
  showHeader = true,
}) {
  // Batasi kedalaman render maksimal 200 cm untuk skala visual
  const clampedDepth = Math.max(0, Math.min(200, depthCm));
  const impact = getDepthImpact(clampedDepth);

  // Dimensi SVG
  // Y = 0 (atas, 200cm), Y = 280 (tanah, 0cm)
  const svgHeight = 320;
  const svgWidth = 460;
  const groundY = 280; // Posisi dasar tanah
  const rulerHeight = 250; // Tinggi dari 0 cm ke 200 cm (1.25 px per cm)
  const pxPerCm = rulerHeight / 200;

  // Koordinat Y permukaan air (dari atas SVG)
  const waterY = groundY - clampedDepth * pxPerCm;
  const waterHeight = clampedDepth * pxPerCm;

  // Ukuran referensi:
  // Dewasa: 170 cm * 1.25 = 212.5 px
  // Anak: 110 cm * 1.25 = 137.5 px
  const adultHeightPx = 170 * pxPerCm;
  const childHeightPx = 110 * pxPerCm;
  const adultTopY = groundY - adultHeightPx;
  const childTopY = groundY - childHeightPx;

  return (
    <div className="flood-vis-container">
      {/* Header Info Kedalaman */}
      {showHeader && <div className="flood-vis-header">
        <div>
          <span className="flood-vis-eyebrow">
            {isSimulation ? "SKENARIO SIMULASI" : "INDIKATOR KEDALAMAN AIR"}
          </span>
          <div className="flood-vis-depth-badge">
            <span className="depth-number">{Math.round(clampedDepth)}</span>
            <span className="depth-unit">cm</span>
            <span className="depth-meters">({(clampedDepth / 100).toFixed(2)} meter)</span>
          </div>
        </div>

        <div
          className="flood-vis-status-pill"
          style={{
            color: impact.badgeColor,
            background: impact.bgBadge,
            borderColor: impact.badgeColor,
          }}
        >
          <span className="pill-dot" style={{ backgroundColor: impact.badgeColor }} />
          <span>{impact.label}</span>
        </div>
      </div>}

      {/* SVG Canvas Human-Scale */}
      <div className="flood-vis-svg-wrapper">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="flood-vis-svg"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`Visualisasi kedalaman air ${clampedDepth} sentimeter dibandingkan figur dewasa 170 sentimeter dan anak 110 sentimeter`}
        >
          <defs>
            {/* Gradien Air Biru Tenang */}
            <linearGradient id="waterGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.95" />
            </linearGradient>

            {/* Pola Gelombang Halus pada Permukaan Air */}
            <linearGradient id="waterSurface" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#bae6fd" />
              <stop offset="50%" stopColor="#e0f2fe" />
              <stop offset="100%" stopColor="#bae6fd" />
            </linearGradient>

            {/* Bayangan Garis Air */}
            <filter id="waterGlow" x="-5%" y="-20%" width="110%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#0369a1" floodOpacity="0.3" />
            </filter>
          </defs>

          {/* Background Grid Bersih */}
          <rect x="0" y="0" width={svgWidth} height={svgHeight} fill="#F8FAFC" />

          {/* Garis Horizontal Pengukur Tinggi setiap 50 cm */}
          {[0, 50, 100, 150, 200].map((val) => {
            const y = groundY - val * pxPerCm;
            return (
              <g key={`grid-h-${val}`}>
                <line
                  x1="70"
                  y1={y}
                  x2={svgWidth - 20}
                  y2={y}
                  stroke="#E2E8F0"
                  strokeWidth="1"
                  strokeDasharray={val === 0 ? "none" : "3,3"}
                />
                <text
                  x="62"
                  y={y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fontWeight={val === 100 || val === 0 ? "700" : "500"}
                  fill="#64748B"
                >
                  {val} cm
                </text>
              </g>
            );
          })}

          {/* ============================================================== */}
          {/* VERTICAL RULER SCALE DI SISI KIRI                              */}
          {/* ============================================================== */}
          <line x1="70" y1={groundY - 200 * pxPerCm} x2="70" y2={groundY} stroke="#94A3B8" strokeWidth="2" />
          {[0, 20, 50, 80, 100, 140, 170, 200].map((tick) => {
            const y = groundY - tick * pxPerCm;
            const isMajor = tick % 50 === 0 || tick === 170 || tick === 110;
            return (
              <line
                key={`tick-${tick}`}
                x1={isMajor ? "62" : "66"}
                y1={y}
                x2="70"
                y2={y}
                stroke={isMajor ? "#475569" : "#94A3B8"}
                strokeWidth={isMajor ? "1.5" : "1"}
              />
            );
          })}

          {/* ============================================================== */}
          {/* FIGUR DEWASA (Referensi Tinggi ~170 cm)                        */}
          {/* Posisi X: ~180 px                                             */}
          {/* ============================================================== */}
          <g className="figure-adult" transform="translate(150, 0)">
            {/* Label Nama & Tinggi */}
            <text x="35" y={adultTopY - 14} textAnchor="middle" fontSize="12" fontWeight="700" fill="#1E293B">
              Dewasa
            </text>
            <text x="35" y={adultTopY - 2} textAnchor="middle" fontSize="10" fill="#64748B">
              ~170 cm
            </text>

            {/* Garis Titik-titik Puncak Kepala */}
            <line
              x1="0"
              y1={adultTopY}
              x2="70"
              y2={adultTopY}
              stroke="#CBD5E1"
              strokeWidth="1"
              strokeDasharray="2,2"
            />

            {/* Kepala */}
            <circle cx="35" cy={adultTopY + 14} r="13" fill="#334155" />

            {/* Leher & Tubuh */}
            <path
              d={`
                M 25 ${adultTopY + 28}
                L 45 ${adultTopY + 28}
                L 47 ${adultTopY + 105}
                L 23 ${adultTopY + 105}
                Z
              `}
              fill="#475569"
              rx="4"
            />

            {/* Lengan Kiri & Kanan */}
            <rect x="15" y={adultTopY + 30} width="7" height="70" rx="3.5" fill="#334155" />
            <rect x="48" y={adultTopY + 30} width="7" height="70" rx="3.5" fill="#334155" />

            {/* Kaki Kiri & Kanan */}
            <rect x="24" y={adultTopY + 105} width="9" height={adultHeightPx - 105} rx="4" fill="#1E293B" />
            <rect x="37" y={adultTopY + 105} width="9" height={adultHeightPx - 105} rx="4" fill="#1E293B" />

            {/* Sepatu / Kaki di Tanah */}
            <ellipse cx="27" cy={groundY - 2} rx="7" ry="3" fill="#0F172A" />
            <ellipse cx="43" cy={groundY - 2} rx="7" ry="3" fill="#0F172A" />
          </g>

          {/* ============================================================== */}
          {/* FIGUR ANAK (Referensi Tinggi ~110 cm)                          */}
          {/* Posisi X: ~280 px                                             */}
          {/* ============================================================== */}
          <g className="figure-child" transform="translate(290, 0)">
            {/* Label Nama & Tinggi */}
            <text x="25" y={childTopY - 14} textAnchor="middle" fontSize="12" fontWeight="700" fill="#1E293B">
              Anak
            </text>
            <text x="25" y={childTopY - 2} textAnchor="middle" fontSize="10" fill="#64748B">
              ~110 cm
            </text>

            {/* Garis Titik-titik Puncak Kepala */}
            <line
              x1="0"
              y1={childTopY}
              x2="50"
              y2={childTopY}
              stroke="#CBD5E1"
              strokeWidth="1"
              strokeDasharray="2,2"
            />

            {/* Kepala */}
            <circle cx="25" cy={childTopY + 12} r="11" fill="#0D9488" />

            {/* Tubuh */}
            <path
              d={`
                M 17 ${childTopY + 24}
                L 33 ${childTopY + 24}
                L 35 ${childTopY + 75}
                L 15 ${childTopY + 75}
                Z
              `}
              fill="#14B8A6"
              rx="3"
            />

            {/* Lengan */}
            <rect x="9" y={childTopY + 26} width="6" height="42" rx="3" fill="#0D9488" />
            <rect x="35" y={childTopY + 26} width="6" height="42" rx="3" fill="#0D9488" />

            {/* Kaki Kiri & Kanan */}
            <rect x="16" y={childTopY + 75} width="7" height={childHeightPx - 75} rx="3" fill="#0F766E" />
            <rect x="27" y={childTopY + 75} width="7" height={childHeightPx - 75} rx="3" fill="#0F766E" />

            {/* Sepatu */}
            <ellipse cx="19" cy={groundY - 2} rx="6" ry="2.5" fill="#115E59" />
            <ellipse cx="31" cy={groundY - 2} rx="6" ry="2.5" fill="#115E59" />
          </g>

          {/* ============================================================== */}
          {/* LAPISAN AIR BERSAMA (SHARED GROUND LEVEL & RISING WATERLINE)   */}
          {/* ============================================================== */}
          {clampedDepth > 0 && (
            <g className="water-layer">
              {/* Badan Air Transparan Menggenangi Kaki Figur */}
              <rect
                x="70"
                y={waterY}
                width={svgWidth - 90}
                height={waterHeight}
                fill="url(#waterGradient)"
                opacity="0.82"
              />

              {/* Garis Permukaan Air dengan Indikator Tegas */}
              <line
                x1="65"
                y1={waterY}
                x2={svgWidth - 15}
                y2={waterY}
                stroke="#0284C7"
                strokeWidth="2.5"
                filter="url(#waterGlow)"
              />

              {/* Tag Penunjuk Ketinggian di Garis Air Sisi Kanan */}
              <rect
                x={svgWidth - 95}
                y={waterY - 11}
                width="82"
                height="22"
                rx="6"
                fill="#0369A1"
                stroke="#BAE6FD"
                strokeWidth="1.5"
              />
              <text
                x={svgWidth - 54}
                y={waterY + 4}
                textAnchor="middle"
                fontSize="11"
                fontWeight="700"
                fill="#FFFFFF"
              >
                ▼ {Math.round(clampedDepth)} cm
              </text>
            </g>
          )}

          {/* ============================================================== */}
          {/* DASAR TANAH (SHARED GROUND LEVEL)                              */}
          {/* ============================================================== */}
          <rect x="0" y={groundY} width={svgWidth} height={svgHeight - groundY} fill="#E2E8F0" />
          <line x1="0" y1={groundY} x2={svgWidth} y2={groundY} stroke="#94A3B8" strokeWidth="2.5" />
          <text x="35" y={groundY + 18} fontSize="11" fontWeight="700" fill="#475569">
            0 cm
          </text>
          <text x={svgWidth / 2} y={groundY + 22} textAnchor="middle" fontSize="11" fontWeight="600" fill="#64748B">
            Permukaan Tanah Bersama (Ground Baseline)
          </text>
        </svg>
      </div>

      {/* Ringkasan Dampak untuk 4 Kategori Pengguna */}
      {showImpactCards && (
        <div className="flood-impact-grid">
          <div className="impact-card">
            <div className="impact-card-header">
              <span className="impact-icon">🚶</span>
              <strong>Pejalan Kaki Dewasa</strong>
            </div>
            <p>{impact.pedestrian}</p>
          </div>

          <div className="impact-card highlight-child">
            <div className="impact-card-header">
              <span className="impact-icon">👶</span>
              <strong>Anak-Anak</strong>
            </div>
            <p>{impact.children}</p>
          </div>

          <div className="impact-card">
            <div className="impact-card-header">
              <span className="impact-icon">🛵</span>
              <strong>Sepeda Motor</strong>
            </div>
            <p>{impact.motorcycle}</p>
          </div>

          <div className="impact-card">
            <div className="impact-card-header">
              <span className="impact-icon">🚗</span>
              <strong>Mobil Penumpang</strong>
            </div>
            <p>{impact.car}</p>
          </div>
        </div>
      )}

      {/* Pesan Keselamatan Berdasarkan Ketinggian */}
      <div className="flood-vis-advice" style={{ borderLeftColor: impact.badgeColor }}>
        <div className="advice-title">
          <IconAlertTriangle size={15} color={impact.badgeColor} />
          <strong>Rekomendasi Tindakan:</strong>
        </div>
        <p>{impact.advice}</p>
      </div>
    </div>
  );
}
