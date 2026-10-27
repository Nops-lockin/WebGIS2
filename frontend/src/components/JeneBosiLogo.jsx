import React from "react";

/**
 * JeneBosiLogo: Logo Resmi Vektor WebGIS Mitigasi Banjir Kota Makassar
 * Filosofi Desain:
 * 1. Bentuk Tameng / Perisai (Shield) khas perlindungan maritim Makassar.
 * 2. Tetesan Air Hujan (Bosi) aerodinamis di bagian atas dengan gradien cyan atmosfer BMKG.
 * 3. Aliran Gelombang Sungai & Pesisir (Jene') berlapis di bagian bawah dengan warna teal emerald.
 * 4. Titik koordinat GIS / Radar di pusat pusaran air.
 */
export default function JeneBosiLogo({ size = 32, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Logo JeneBosi WebGIS Makassar"
    >
      <defs>
        {/* Gradien Perisai Dasar */}
        <linearGradient id="jb-shield-grad" x1="15" y1="10" x2="85" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0B131E" />
          <stop offset="100%" stopColor="#04080D" />
        </linearGradient>

        {/* Gradien Border Perisai Halus */}
        <linearGradient id="jb-border-grad" x1="10" y1="5" x2="90" y2="95" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#0EA5E9" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#10B981" stopOpacity="0.6" />
        </linearGradient>

        {/* Gradien Tetesan Hujan (Bosi) */}
        <linearGradient id="jb-bosi-drop" x1="50" y1="20" x2="50" y2="70" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7DD3FC" />
          <stop offset="50%" stopColor="#0EA5E9" />
          <stop offset="100%" stopColor="#0284C7" />
        </linearGradient>

        {/* Gradien Gelombang Aliran Air (Jene') */}
        <linearGradient id="jb-jene-wave" x1="20" y1="65" x2="80" y2="85" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="50%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#0F766E" />
        </linearGradient>

        {/* Efek Cahaya / Glow */}
        <filter id="jb-glow" x="-20%" y="-20%" width="140%" height="140%" filterUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* 1. Tameng / Perisai Pelindung Makassar */}
      <path
        d="M 50 8 
           C 72 16, 88 18, 88 42 
           C 88 65, 68 83, 50 92 
           C 32 83, 12 65, 12 42 
           C 12 18, 28 16, 50 8 Z"
        fill="url(#jb-shield-grad)"
        stroke="url(#jb-border-grad)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {/* 2. Gelombang Luapan Air & Kanal (Jene') - Lapisan Bawah */}
      <path
        d="M 23 60 
           C 34 52, 45 68, 56 60 
           C 65 53, 72 57, 77 62 
           C 70 76, 58 84, 50 88 
           C 42 84, 30 76, 23 60 Z"
        fill="url(#jb-jene-wave)"
        opacity="0.9"
      />

      {/* 3. Tetesan Air Hujan Atmosfer (Bosi) & Pin Lokasi Geospasial */}
      <path
        d="M 50 20 
           C 50 20, 66 39, 66 52 
           C 66 61, 58.8 68, 50 68 
           C 41.2 68, 34 61, 34 52 
           C 34 39, 50 20, 50 20 Z"
        fill="url(#jb-bosi-drop)"
        filter="url(#jb-glow)"
      />

      {/* 4. Sinar Refleksi Permukaan Tetesan Air */}
      <path
        d="M 44 33 
           C 40 40, 39 48, 41 53 
           C 41.5 54.5, 43 53.5, 42.8 52 
           C 41.5 47, 42.5 40, 46 34 
           C 46.8 32.5, 45 31.5, 44 33 Z"
        fill="#FFFFFF"
        opacity="0.75"
      />

      {/* 5. Inti Pusat Radar / Titik Koordinat GIS (Pusaran Keamanan) */}
      <circle cx="50" cy="51" r="5" fill="#FFFFFF" />
      <circle cx="50" cy="51" r="9" stroke="#38BDF8" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.85" />
    </svg>
  );
}
