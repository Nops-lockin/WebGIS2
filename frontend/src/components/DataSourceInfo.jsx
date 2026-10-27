import React from "react";
import { IconBookOpen, IconAlertTriangle } from "../Icons";

export default function DataSourceInfo() {
  return (
    <section id="tentang" className="datasource-section">
      <div className="section-container">
        <div className="section-header-block">
          <div className="section-badge">
            <IconBookOpen size={16} color="#176B65" />
            <span>Transparansi & Metodologi</span>
          </div>
          <h2 className="section-title">Tentang Sumber Data & Metodologi Analisis</h2>
          <p className="section-subtitle">
            JeneBosi (JB) dibangun atas prinsip integritas data ilmiah dan kejujuran informasi publik.
            Berikut rincian sumber data, klasifikasi risiko, serta batasan analitis sistem.
          </p>
        </div>

        {/* 4 Pilar Sumber Data */}
        <div className="sources-grid">
          <div className="source-card">
            <div className="source-badge">Prakiraan Cuaca</div>
            <strong className="source-title">BMKG (Badan Meteorologi, Klimatologi, dan Geofisika)</strong>
            <p className="source-desc">
              Data prakiraan cuaca numerik BMKG (suhu, kelembapan, kondisi langit, potensi hujan) yang disinkronkan
              melalui API resmi BMKG untuk seluruh kecamatan dan kelurahan di Kota Makassar.
            </p>
            <span className="source-type-tag">Tipe: Prakiraan Numerik (Forecast)</span>
          </div>

          <div className="source-card">
            <div className="source-badge">Elevasi & Topografi</div>
            <strong className="source-title">Copernicus DEM GLO-90 & Open-Meteo</strong>
            <p className="source-desc">
              Data Digital Elevation Model (DEM) resolusi 90 meter dari misi satelit Copernicus untuk menghitung
              ketinggian tanah rata-rata di atas permukaan air laut (m dpl) pada 153 kelurahan.
            </p>
            <span className="source-type-tag">Tipe: Data Spasial Satelit</span>
          </div>

          <div className="source-card">
            <div className="source-badge">Batas Administrasi & Peta</div>
            <strong className="source-title">OpenStreetMap & Esri World Imagery</strong>
            <p className="source-desc">
              Batas polygon 153 kelurahan Makassar dari repositori spasial resmi, disajikan di atas basemap OpenStreetMap
              (Peta Jalan) dan citra satelit resolusi tinggi Esri.
            </p>
            <span className="source-type-tag">Tipe: Vektor Geospasial & Citra Satelit</span>
          </div>

          <div className="source-card">
            <div className="source-badge">Kesiapsiagaan Bencana</div>
            <strong className="source-title">BPBD Kota Makassar & Standar BNPB</strong>
            <p className="source-desc">
              Rekomendasi tindakan mitigasi, daftar nomor darurat Call Center 112, dan panduan tas siaga bencana disusun
              mengacu pada panduan resmi kesiapsiagaan bencana hidrometeorologi.
            </p>
            <span className="source-type-tag">Tipe: Panduan Operasional Publik</span>
          </div>
        </div>

        {/* Tabel Definisi Kategori Risiko */}
        <div className="methodology-card">
          <h3 className="methodology-title">Definisi & Batasan Kategori Risiko Banjir</h3>
          <p className="methodology-intro">
            Setiap kelurahan diklasifikasikan ke dalam 4 kategori risiko berdasarkan kombinasi elevasi tanah (m dpl),
            curah hujan harian, dan riwayat kerentanan spasial:
          </p>

          <div className="risk-definitions-table">
            <div className="risk-def-row">
              <div className="risk-def-badge" style={{ backgroundColor: "#2F855A" }}>
                Aman (Data Tersedia)
              </div>
              <div className="risk-def-content">
                <strong>Elevasi &gt; 12 m dpl atau kawasan dataran stabil.</strong>
                <p>
                  Risiko genangan rendah pada kondisi hujan normal. <em>Penting:</em> Label hijau ini tidak berarti
                  wilayah kebal 100% dari banjir jika terjadi badai siklon tropis atau kegagalan drainase ekstrem.
                </p>
              </div>
            </div>

            <div className="risk-def-row">
              <div className="risk-def-badge" style={{ backgroundColor: "#D69E2E" }}>
                Waspada
              </div>
              <div className="risk-def-content">
                <strong>Elevasi 8 – 12 m dpl dengan kemiringan landai.</strong>
                <p>
                  Berpotensi timbul genangan air setinggi 10–30 cm pada jalan lingkungan dan cekungan lokal saat hujan
                  berdurasi lebih dari 2 jam.
                </p>
              </div>
            </div>

            <div className="risk-def-row">
              <div className="risk-def-badge" style={{ backgroundColor: "#DD6B20" }}>
                Siaga Banjir
              </div>
              <div className="risk-def-content">
                <strong>Elevasi 3 – 8 m dpl atau berdekatan dengan drainase utama.</strong>
                <p>
                  Genangan air berpotensi mencapai 30–70 cm. Warga disarankan mengamankan barang berharga dan waspada
                  terhadap hewan berbahaya dari luapan selokan.
                </p>
              </div>
            </div>

            <div className="risk-def-row">
              <div className="risk-def-badge" style={{ backgroundColor: "#C53030" }}>
                Bahaya Ekstrem
              </div>
              <div className="risk-def-content">
                <strong>Elevasi &lt; 3 m dpl (dataran pantai/muara atau bantaran sungai).</strong>
                <p>
                  Risiko banjir parah &gt; 100 cm saat hujan lebat bertepatan dengan pasang air laut maksimum (rob).
                  Jalur evakuasi dan posko pengungsian harus disiapkan sejak dini.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Batasan Sistem (Honest Limitations) */}
        <div className="limitations-banner">
          <div className="limitations-icon">
            <IconAlertTriangle size={24} color="#C53030" />
          </div>
          <div>
            <strong className="limitations-title">Batasan Analisis & Penyangkalan Hukum (Disclaimer)</strong>
            <p className="limitations-desc">
              JeneBosi (JB) ditujukan sebagai media edukasi dan kesiapsiagaan awal masyarakat, bukan sistem peringatan dini
              otomatis berbasis sensor real-time lapangan (Automatic Water Level Recorder / AWLR). Kedalaman air yang
              ditampilkan pada simulator bersifat <strong>ilustratif edukatif</strong>. Dalam situasi darurat bencana,
              seluruh keputusan evakuasi resmi harus merujuk pada komando BPBD Kota Makassar, Basarnas, dan Pemerintah
              Kota Makassar.
            </p>
          </div>
        </div>

        {/* Footer Hak Cipta & Tim */}
        <div className="platform-footer">
          <div>
            <strong>JeneBosi (JB) &bull; Kesiapsiagaan Banjir Makassar</strong>
            <p style={{ marginTop: "4px", fontSize: "12px", color: "#64748B" }}>
              Dikembangkan oleh: Flarino Marco Cristvan Zakaria, Ryan Adiputra Darmawan, Naufal Asa Malika.
            </p>
          </div>
          <div className="footer-links">
            <a href="#peta">Kembali ke Peta</a>
            <span>&bull;</span>
            <a href="#simulasi">Simulator</a>
            <span>&bull;</span>
            <a href="#panduan">Panduan Siaga</a>
          </div>
        </div>
      </div>
    </section>
  );
}
