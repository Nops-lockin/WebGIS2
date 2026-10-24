import React from "react";

const STEPS = [
  ["1", "Cek lokasi", "Cari kelurahan atau gunakan tombol lokasi pada peta untuk melihat status wilayah."],
  ["2", "Siapkan diri", "Simpan dokumen, obat, dan barang penting di tempat aman. Hindari saluran dan genangan."],
  ["3", "Evakuasi bila perlu", "Gunakan rute ke posko terdekat. Hubungi 112 jika ada keadaan darurat."],
];

export default function CitizenSafetyGuide() {
  return (
    <section id="panduan" className="citizen-guide-section" aria-labelledby="citizen-guide-title">
      <div className="section-container">
        <div className="citizen-guide-card">
          <div className="citizen-guide-heading">
            <span className="citizen-guide-eyebrow">PANDUAN SINGKAT UNTUK WARGA</span>
            <h2 id="citizen-guide-title">Jika hujan deras atau banjir terjadi</h2>
            <p>Mulai dari mengecek wilayah Anda, lalu ikuti langkah aman berikut.</p>
          </div>
          <div className="citizen-guide-steps">
            {STEPS.map(([number, title, text]) => (
              <div className="citizen-guide-step" key={number}>
                <span className="citizen-step-number">{number}</span>
                <div>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
          <a className="citizen-emergency-link" href="tel:112">📞 Darurat: hubungi 112</a>
        </div>
      </div>
    </section>
  );
}
