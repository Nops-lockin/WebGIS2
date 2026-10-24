import React, { useState, useEffect, useMemo, useCallback } from "react";
import AppHeader from "./components/AppHeader";
import IntroSection from "./components/IntroSection";
import FloodMap from "./components/FloodMap";
import SelectedAreaPanel, { getRiskBadge } from "./components/SelectedAreaPanel";
import FloodDepthSimulator from "./components/FloodDepthSimulator";
import RainfallInsight from "./components/RainfallInsight";
import PreparednessChecklist from "./components/PreparednessChecklist";
import DataSourceInfo from "./components/DataSourceInfo";
import MobileBottomSheet from "./components/MobileBottomSheet";
import MobileDrawerModal from "./components/MobileDrawerModal";
import TideMonitorWidget from "./components/TideMonitorWidget";
import SimulationController from "./components/SimulationController";
import CitizenSafetyGuide from "./components/CitizenSafetyGuide";
import WaterHeightSimulatorModal from "./components/WaterHeightSimulatorModal";
import { generateJalurEvakuasi } from "./utils/evacuationRouting";
import { POSKO_EVAKUASI_MAKASSAR } from "./data/evakuasiDanKanal";
import {
  IconShield,
  IconSearch,
  IconClose,
  IconLaptop,
  IconCompass,
  IconInfo,
} from "./Icons";

const API = "http://127.0.0.1:8000";

// Normalisasi response prakiraan BMKG
function normalisasiPrakiraan(dataApi) {
  let daftar = [];
  if (Array.isArray(dataApi?.prakiraan)) {
    daftar = dataApi.prakiraan;
  } else if (Array.isArray(dataApi?.data?.prakiraan)) {
    daftar = dataApi.data.prakiraan;
  } else if (Array.isArray(dataApi?.cuaca)) {
    daftar = dataApi.cuaca.flat(Infinity);
  } else if (Array.isArray(dataApi)) {
    daftar = dataApi;
  }

  return daftar
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      ...item,
      waktu_lokal: item.waktu_lokal || item.datetime || item.waktu || null,
      suhu_c: item.suhu_c ?? item.suhu ?? item.temperature ?? null,
      kelembapan_persen: item.kelembapan_persen ?? item.kelembapan ?? item.humidity ?? null,
      kondisi: item.kondisi || item.weather_desc || item.cuaca || "Berawan",
    }));
}

export default function App() {
  // Mode Tampilan: "laptop" | "mobile"
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth < 768 ? "mobile" : "laptop";
    }
    return "laptop";
  });

  const [geojson, setGeojson] = useState(null);
  const [banjir, setBanjir] = useState([]);

  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("semua"); // "semua" | "rendah" | "sedang" | "tinggi" | "sangat_tinggi"
  const [selectedKelurahan, setSelectedKelurahan] = useState(null);

  const [prakiraan, setPrakiraan] = useState([]);
  const [loadingPrakiraan, setLoadingPrakiraan] = useState(false);
  const [errorPrakiraan, setErrorPrakiraan] = useState("");

  // =========================================================================
  // FITUR: DUAL MODE REAL-TIME VS MODE SIMULASI PENGUJIAN
  // =========================================================================
  const [isSimulation, setIsSimulation] = useState(false);
  const [simulationModalOpen, setSimulationModalOpen] = useState(false);
  const [waterSimulatorOpen, setWaterSimulatorOpen] = useState(false);
  const [simulationState, setSimulationState] = useState({
    activePreset: "normal",
    nama: "☀️ Skenario 1: Normal",
    rainMm: 0,
    tideM: 0.45,
    depthCm: 0,
    riverOverflow: false,
    bufferM: 200,
  });

  // FITUR 2: JALUR EVAKUASI TERAMAN (ACTIVE ROUTE)
  const [activeRoute, setActiveRoute] = useState(null);

  // FITUR 4: RADIUS BAHAYA LUAPAN KANAL (BUFFER ZONE)
  const [activeBufferRiver, setActiveBufferRiver] = useState("kanal-panampu");
  const [bufferRadius, setBufferRadius] = useState(250);
  const [bufferToolOpen, setBufferToolOpen] = useState(false);

  // FITUR 6: FASILITAS KRITIS RADAR
  const [facilityCategory, setFacilityCategory] = useState("semua");

  // State Modal Drawer untuk Mode HP
  const [mobileModalActive, setMobileModalActive] = useState(null); // null | "simulasi_kedalaman" | "panduan" | "cuaca" | "pasut" | "tentang" | "simulasi_pengujian" | "buffer"

  // 1. Fetch data spasial & analitis utama saat mount
  useEffect(() => {
    let isMounted = true;

    async function loadInitialData() {
      try {
        setError("");

        const [resGeo, resBanjir] = await Promise.all([
          fetch(`${API}/api/kelurahan/geojson`),
          fetch(`${API}/api/banjir`),
        ]);

        if (!resGeo.ok) throw new Error("Gagal mengambil batas wilayah kelurahan.");
        const geoData = await resGeo.json();

        let banjirData = [];
        if (resBanjir.ok) {
          const bJson = await resBanjir.json();
          banjirData = Array.isArray(bJson) ? bJson : bJson.data || [];
        }

        if (isMounted) {
          setGeojson(geoData);
          setBanjir(banjirData);
        }
      } catch (err) {
        if (isMounted) {
          console.error("Fetch error:", err);
          setError(err.message || "Gagal memuat data WebGIS.");
        }
      }
    }

    loadInitialData();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Fetch prakiraan BMKG saat kelurahan dipilih
  useEffect(() => {
    if (!selectedKelurahan?.kode_wilayah) {
      fetch(`${API}/api/bmkg/prakiraan/73.71`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d) setPrakiraan(normalisasiPrakiraan(d));
        })
        .catch(() => {});
      return;
    }

    const controller = new AbortController();
    setLoadingPrakiraan(true);
    setErrorPrakiraan("");

    fetch(`${API}/api/bmkg/prakiraan/${selectedKelurahan.kode_wilayah}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          return fetch(`${API}/api/prakiraan/${selectedKelurahan.kode_wilayah}`);
        }
        return res;
      })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setPrakiraan(normalisasiPrakiraan(data));
        } else {
          setPrakiraan([]);
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setErrorPrakiraan("Gagal mengambil data prakiraan BMKG.");
        }
      })
      .finally(() => {
        setLoadingPrakiraan(false);
      });

    return () => controller.abort();
  }, [selectedKelurahan?.kode_wilayah]);

  // Daftar kelurahan untuk pencarian
  const daftarKelurahan = useMemo(() => {
    if (!geojson || !Array.isArray(geojson.features)) return [];
    return geojson.features.map((f) => ({
      id: f.properties.id,
      nama_kelurahan: f.properties.nama_kelurahan,
      kode_wilayah: f.properties.kode_wilayah,
      feature: f,
    }));
  }, [geojson]);

  // Statistik agregat (dihitung dinamis saat Mode Simulasi aktif)
  const summary = useMemo(() => {
    if (isSimulation && geojson?.features) {
      const rain = simulationState.rainMm ?? 0;
      const tide = simulationState.tideM ?? 0.45;

      let r = 0,
        s = 0,
        t = 0,
        st = 0;

      geojson.features.forEach((f) => {
        const id = f.properties.id;
        const nama = (f.properties.nama_kelurahan || "").toLowerCase();
        const e = 5;
        const isCoastal = e < 4.5;
        const isBasin = ["antang", "manggala", "tamalanrea", "tamangapa", "karunrung"].some((k) =>
          nama.includes(k)
        );

        if (rain >= 120 || (rain >= 70 && tide >= 1.35) || (isCoastal && tide >= 1.45)) {
          st++;
        } else if (rain >= 60 || (isBasin && rain >= 40) || (isCoastal && tide >= 1.15)) {
          t++;
        } else if (rain >= 25 || tide >= 1.0) {
          s++;
        } else {
          r++;
        }
      });

      return {
        total: geojson.features.length,
        rendah: r,
        sedang: s,
        tinggi: t,
        sangat_tinggi: st,
      };
    }

    const counts = { total: 0, rendah: 0, sedang: 0, tinggi: 0, sangat_tinggi: 0 };
    banjir.forEach((item) => {
      counts.total += 1;
      const t = String(item.tingkat || "").toLowerCase();
      if (t.includes("sangat") || t.includes("ekstrem")) counts.sangat_tinggi += 1;
      else if (t.includes("tinggi") || t.includes("siaga")) counts.tinggi += 1;
      else if (t.includes("sedang") || t.includes("waspada")) counts.sedang += 1;
      else counts.rendah += 1;
    });

    if (banjir.length > 0) counts.total = banjir.length;
    return counts;
  }, [banjir, isSimulation, simulationState, geojson]);

  // Handler memilih kelurahan dari dropdown / search
  const handleSelectKelurahan = useCallback(
    (item) => {
      const feat = geojson?.features.find((f) => f.properties.id === item.id);
      const b = banjir.find((x) => x.kelurahan_id === item.id || x.nama_kelurahan === item.nama_kelurahan);

      setSelectedKelurahan({
        id: item.id,
        nama_kelurahan: item.nama_kelurahan,
        kode_wilayah: item.kode_wilayah || b?.kode_wilayah,
        kecamatan: b?.kecamatan || "",
        tingkat: b?.tingkat || "Rendah",
        estimasi_kedalaman_cm: b?.estimasi_kedalaman_cm ?? null,
        kondisi_bmkg: b?.kondisi_bmkg ?? null,
        waktu_analisis: b?.waktu_analisis ?? null,
        feature: feat,
      });
    },
    [geojson, banjir]
  );

  // FITUR 2: HANDLER GENERATE JALUR EVAKUASI TERAMAN
  const handleShowRoute = useCallback(
    (kelurahanItem, poskoItem) => {
      let startCoords = [-5.1477, 119.4327];
      if (kelurahanItem?.feature?.geometry) {
        const geom = kelurahanItem.feature.geometry;
        if (geom.type === "Polygon" && geom.coordinates[0]?.[0]) {
          startCoords = [geom.coordinates[0][0][1], geom.coordinates[0][0][0]];
        } else if (geom.type === "MultiPolygon" && geom.coordinates[0]?.[0]?.[0]) {
          startCoords = [geom.coordinates[0][0][0][1], geom.coordinates[0][0][0][0]];
        }
      }

      const targetPosko =
        poskoItem ||
        POSKO_EVAKUASI_MAKASSAR.find(
          (p) =>
            kelurahanItem?.kecamatan &&
            p.kecamatan.toLowerCase().includes(kelurahanItem.kecamatan.toLowerCase())
        ) ||
        POSKO_EVAKUASI_MAKASSAR[0];

      const destCoords = [targetPosko.latitude, targetPosko.longitude];
      const generated = generateJalurEvakuasi(
        startCoords,
        destCoords,
        isSimulation ? simulationState : null
      );

      setActiveRoute({
        ...generated,
        originName: `Kel. ${kelurahanItem?.nama_kelurahan || "Asal"}`,
        targetPosko,
      });

      const el = document.getElementById("peta");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    },
    [isSimulation, simulationState]
  );

  // Handler rute ke Fasilitas Kritis
  const handleStartRouteToFacility = useCallback(
    (facilityItem) => {
      let startCoords = [-5.1477, 119.4327];
      if (selectedKelurahan?.feature?.geometry) {
        const geom = selectedKelurahan.feature.geometry;
        if (geom.type === "Polygon" && geom.coordinates[0]?.[0]) {
          startCoords = [geom.coordinates[0][0][1], geom.coordinates[0][0][0]];
        }
      }

      const destCoords = [facilityItem.latitude, facilityItem.longitude];
      const generated = generateJalurEvakuasi(
        startCoords,
        destCoords,
        isSimulation ? simulationState : null
      );

      setActiveRoute({
        ...generated,
        originName: selectedKelurahan ? `Kel. ${selectedKelurahan.nama_kelurahan}` : "Pusat Kota Makassar",
        targetPosko: {
          nama: facilityItem.nama,
          alamat: facilityItem.alamat,
          kontak: facilityItem.kontak,
        },
      });

      const el = document.getElementById("peta");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    },
    [selectedKelurahan, isSimulation, simulationState]
  );

  // Reset mode simulasi kembali ke real-time
  const handleResetSimulation = () => {
    setIsSimulation(false);
    setSimulationState({
      activePreset: "normal",
      nama: "☀️ Skenario 1: Normal",
      rainMm: 0,
      tideM: 0.45,
      depthCm: 0,
      riverOverflow: false,
      bufferM: 200,
    });
    setSimulationModalOpen(false);
  };

  // =========================================================================
  // RENDER 1: MODE HP / SMARTPHONE (MOBILE WEB APP EXPERIENCE)
  // =========================================================================
  if (viewMode === "mobile") {
    const badge = selectedKelurahan ? getRiskBadge(selectedKelurahan.tingkat) : null;

    return (
      <div className="mobile-view-wrapper">
        {/* Floating Top Header Island */}
        <div className="mobile-top-bar">
          <div className="mobile-bar-main">
            <div className="mobile-brand">
              <div className="mobile-brand-icon">
                <IconShield size={16} color="#FFFFFF" />
              </div>
              <strong className="mobile-brand-title">WebGIS2MBC</strong>
            </div>

            {/* Quick Search Input */}
            <div className="mobile-search-pill">
              <IconSearch size={14} color="#64748B" />
              <input
                type="text"
                placeholder="Cari kelurahan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mobile-search-input"
              />
              {search && (
                <button type="button" onClick={() => setSearch("")} className="mobile-search-clear">
                  <IconClose size={12} color="#64748B" />
                </button>
              )}
            </div>

            {/* Tombol Beralih ke Mode Laptop */}
            <button
              type="button"
              className="mode-toggle-chip"
              onClick={() => setViewMode("laptop")}
              title="Beralih ke Tampilan Laptop"
            >
              <IconLaptop size={14} color="#176B65" />
              <span>Laptop</span>
            </button>
          </div>

          {/* Horizontal Scroll Chips */}
          <div className="mobile-scroll-chips">
            <button
              type="button"
              className={`mobile-chip ${filter === "semua" ? "active" : ""}`}
              onClick={() => setFilter("semua")}
            >
              Semua ({summary.total})
            </button>
            <button
              type="button"
              className={`mobile-chip chip-aman ${filter === "rendah" ? "active" : ""}`}
              onClick={() => setFilter("rendah")}
            >
              Aman ({summary.rendah})
            </button>
            <button
              type="button"
              className={`mobile-chip chip-waspada ${filter === "sedang" ? "active" : ""}`}
              onClick={() => setFilter("sedang")}
            >
              Waspada ({summary.sedang})
            </button>
            <button
              type="button"
              className={`mobile-chip chip-siaga ${filter === "tinggi" ? "active" : ""}`}
              onClick={() => setFilter("tinggi")}
            >
              Siaga ({summary.tinggi})
            </button>
            <button
              type="button"
              className={`mobile-chip chip-bahaya ${filter === "sangat_tinggi" ? "active" : ""}`}
              onClick={() => setFilter("sangat_tinggi")}
            >
              Bahaya ({summary.sangat_tinggi})
            </button>

            <span className="chips-divider">|</span>

            <button
              type="button"
              className="mobile-chip chip-feature"
              onClick={() => setWaterSimulatorOpen(true)}
            >
              📏 Simulator Air
            </button>
            <button
              type="button"
              className="mobile-chip chip-feature"
              onClick={() => setMobileModalActive("pasut")}
            >
              🌊 Pasang Surut Laut
            </button>
            <button
              type="button"
              className="mobile-chip chip-feature"
              onClick={() => setMobileModalActive("cuaca")}
            >
              🌤️ Cuaca BMKG
            </button>
            <button
              type="button"
              className="mobile-chip chip-feature"
              onClick={() => setMobileModalActive("panduan")}
            >
              📋 Panduan Siaga
            </button>
            <button
              type="button"
              className="mobile-chip chip-feature"
              onClick={() => setMobileModalActive("tentang")}
            >
              ℹ️ Tentang Data
            </button>
          </div>
        </div>

        {/* Peta Fullscreen Layar HP */}
        <div className="mobile-fullscreen-map">
          <FloodMap
            geojson={geojson}
            banjirData={banjir}
            selectedKelurahan={selectedKelurahan}
            onSelectKelurahan={setSelectedKelurahan}
            search={search}
            onSearchChange={setSearch}
            filter={filter}
            onFilterChange={setFilter}
            summary={summary}
            // SIMULATION PROPS
            isSimulation={isSimulation}
            simulationState={simulationState}
            onOpenSimulation={() => setSimulationModalOpen(true)}
            onResetSimulation={handleResetSimulation}
            // ROUTE PROPS
            activeRoute={activeRoute}
            onClearRoute={() => setActiveRoute(null)}
            onStartRouteToFacility={handleStartRouteToFacility}
            // BUFFER PROPS
            activeBufferRiver={activeBufferRiver}
            bufferRadius={bufferRadius}
            onChangeBufferRiver={setActiveBufferRiver}
            onChangeBufferRadius={setBufferRadius}
            bufferToolOpen={bufferToolOpen}
            onToggleBufferTool={() => setBufferToolOpen((p) => !p)}
            // FACILITY PROPS
            facilityCategory={facilityCategory}
            onChangeFacilityCategory={setFacilityCategory}
            publicMode
          />
        </div>

        {/* Interactive Bottom Sheet saat Kelurahan Dipilih */}
        {selectedKelurahan ? (
          <MobileBottomSheet
            selected={selectedKelurahan}
            onClose={() => setSelectedKelurahan(null)}
            prakiraan={prakiraan}
            loadingPrakiraan={loadingPrakiraan}
            errorPrakiraan={errorPrakiraan}
            onOpenSimulator={() => setMobileModalActive("simulasi_kedalaman")}
            onShowRoute={handleShowRoute}
            badge={badge}
            depthVal={selectedKelurahan.kedalaman_air_cm ?? null}
            isSimulation={isSimulation}
            simulationState={simulationState}
          />
        ) : (
          !activeRoute &&
          !bufferToolOpen && (
            <div className="mobile-bottom-prompt">
              <IconCompass size={16} color="#176B65" />
              <span>Ketuk wilayah di peta untuk melihat risiko banjir</span>
            </div>
          )
        )}

        {/* Modal Drawer Fitur Pendukung di HP */}
        <MobileDrawerModal
          isOpen={mobileModalActive === "simulasi_kedalaman"}
          onClose={() => setMobileModalActive(null)}
          title="Simulator Interaktif Ketinggian Air"
        >
          <FloodDepthSimulator
            defaultDepth={35}
            selectedKelurahan={selectedKelurahan}
            isSimulation={isSimulation}
            simulationState={simulationState}
            onSelectKelurahanQuick={(nama) => {
              const found = daftarKelurahan.find((k) => k.nama_kelurahan.toLowerCase().includes(nama.toLowerCase()));
              if (found) handleSelectKelurahan(found);
            }}
          />
        </MobileDrawerModal>

        <MobileDrawerModal
          isOpen={mobileModalActive === "panduan"}
          onClose={() => setMobileModalActive(null)}
          title="Panduan Kesiapsiagaan Banjir"
        >
          <PreparednessChecklist />
        </MobileDrawerModal>

        <MobileDrawerModal
          isOpen={mobileModalActive === "cuaca"}
          onClose={() => setMobileModalActive(null)}
          title="Prakiraan Cuaca BMKG Makassar"
        >
          <RainfallInsight
            prakiraanList={prakiraan}
            selectedKelurahan={selectedKelurahan}
            hujanTerbaru={0}
          />
        </MobileDrawerModal>

        <MobileDrawerModal
          isOpen={mobileModalActive === "pasut"}
          onClose={() => setMobileModalActive(null)}
          title="Pasang Surut Air Laut Selat Makassar"
        >
          <TideMonitorWidget
            onFilterCoastal={() => {
              setSearch("Mariso");
              setMobileModalActive(null);
            }}
          />
        </MobileDrawerModal>

        <MobileDrawerModal
          isOpen={mobileModalActive === "tentang"}
          onClose={() => setMobileModalActive(null)}
          title="Tentang Sumber Data & Metodologi"
        >
          <DataSourceInfo />
        </MobileDrawerModal>

        {/* Modal Pengaturan Mode Simulasi */}
        <SimulationController
          isOpen={simulationModalOpen}
          onClose={() => setSimulationModalOpen(false)}
          isSimulation={isSimulation}
          onToggleMode={(val) => setIsSimulation(val)}
          simulationState={simulationState}
          onChangeSimulation={setSimulationState}
          onResetRealtime={handleResetSimulation}
        />

        <WaterHeightSimulatorModal
          isOpen={waterSimulatorOpen}
          onClose={() => setWaterSimulatorOpen(false)}
          selectedKelurahan={selectedKelurahan}
          onSelectKelurahanQuick={(nama) => {
            const found = daftarKelurahan.find((k) => k.nama_kelurahan.toLowerCase().includes(nama.toLowerCase()));
            if (found) handleSelectKelurahan(found);
          }}
        />
      </div>
    );
  }

  // =========================================================================
  // RENDER 2: MODE LAPTOP / DESKTOP (WIDE 2-COLUMN EXPERIENCE)
  // =========================================================================
  return (
    <div className="webgis-app-root">
      {/* 1. HEADER DENGAN TOMBOL MODE SIMULASI & MODE HP */}
      <AppHeader
        search={search}
        onSearchChange={setSearch}
        daftarKelurahan={daftarKelurahan}
        onSelectKelurahan={handleSelectKelurahan}
        viewMode={viewMode}
        onToggleMode={() => setViewMode("mobile")}
        onOpenWaterSimulator={() => setWaterSimulatorOpen(true)}
      />

      {/* 2. SECTION INTRODUKSI */}
      <IntroSection summary={summary} />

      {/* 3. WORKSPACE PETA UTAMA */}
      <section className="main-map-workspace">
        <div className="workspace-container">
          {error && (
            <div className="error-banner-alert" role="alert">
              <span>⚠️ {error}</span>
            </div>
          )}

          <div className="workspace-columns-layout">
            {/* Kolom 1: Peta Interaktif Leaflet */}
            <div className="workspace-map-col">
              <FloodMap
                geojson={geojson}
                banjirData={banjir}
                selectedKelurahan={selectedKelurahan}
                onSelectKelurahan={setSelectedKelurahan}
                search={search}
                onSearchChange={setSearch}
                filter={filter}
                onFilterChange={setFilter}
                summary={summary}
                // SIMULATION PROPS
                isSimulation={isSimulation}
                simulationState={simulationState}
                onOpenSimulation={() => setSimulationModalOpen(true)}
                onResetSimulation={handleResetSimulation}
                // ROUTE PROPS
                activeRoute={activeRoute}
                onClearRoute={() => setActiveRoute(null)}
                onStartRouteToFacility={handleStartRouteToFacility}
                // BUFFER PROPS
                activeBufferRiver={activeBufferRiver}
                bufferRadius={bufferRadius}
                onChangeBufferRiver={setActiveBufferRiver}
                onChangeBufferRadius={setBufferRadius}
                bufferToolOpen={bufferToolOpen}
                onToggleBufferTool={() => setBufferToolOpen((p) => !p)}
                // FACILITY PROPS
                facilityCategory={facilityCategory}
                onChangeFacilityCategory={setFacilityCategory}
                publicMode
              />
            </div>

            {/* Kolom 2: Panel Detail Wilayah Terpilih */}
            <div className="workspace-panel-col">
              {selectedKelurahan ? (
                <SelectedAreaPanel
                  selected={selectedKelurahan}
                  onClose={() => setSelectedKelurahan(null)}
                  prakiraan={prakiraan}
                  loadingPrakiraan={loadingPrakiraan}
                  errorPrakiraan={errorPrakiraan}
                  onShowRoute={handleShowRoute}
                  isSimulation={isSimulation}
                  simulationState={simulationState}
                />
              ) : (
                /* Card Panduan Awal Ketika Belum Ada Wilayah Terpilih */
                <div className="empty-selection-card">
                  <div className="empty-icon-badge">
                    <IconCompass size={32} color="#176B65" />
                  </div>
                  <h3 className="empty-title">Pilih Kelurahan di Peta</h3>
                  <p className="empty-desc">
                    Klik pada salah satu polygon dari <strong>153 kelurahan</strong> di peta untuk melihat profil risiko
                    banjir, prakiraan cuaca BMKG, serta jalur evakuasi aman.
                  </p>

                  <div className="empty-quick-links">
                    <span className="quick-links-label">Pilihan Cepat Wilayah:</span>
                    <div className="quick-tags-wrap">
                      {["Antang", "Manggala", "Tamalanrea", "Panakkukang", "Mariso"].map((nama) => (
                        <button
                          key={`quick-${nama}`}
                          type="button"
                          className="quick-kel-btn"
                          onClick={() => {
                            const found = daftarKelurahan.find(
                              (k) => k.nama_kelurahan.toLowerCase() === nama.toLowerCase()
                            );
                            if (found) handleSelectKelurahan(found);
                          }}
                        >
                          {nama}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="empty-educational-hint">
                    <IconInfo size={15} color="#64748B" />
                    <span>
                      Pilih wilayah untuk melihat status, prakiraan cuaca, posko, dan rute evakuasi.
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <CitizenSafetyGuide />

      {/* 4. PRAKIRAAN CUACA & DINAMIKA HUJAN BMKG */}
      <RainfallInsight
        prakiraanList={prakiraan}
        selectedKelurahan={selectedKelurahan}
        hujanTerbaru={0}
      />

      {/* FITUR 4: MONITOR PASANG-SURUT AIR LAUT (ROB) SELAT MAKASSAR */}
      <section className="tide-section-wrapper" style={{ padding: "0 0 32px 0" }}>
        <div className="section-container">
          <TideMonitorWidget
            onFilterCoastal={() => {
              setSearch("Mariso");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        </div>
      </section>

      {/* 6. PANDUAN KESIAPSIAGAAN BANJIR WARGA (CHECKLIST INTERAKTIF) */}
      <PreparednessChecklist />

      {/* 7. TRANSPARANSI DATA & METODOLOGI ANALISIS */}
      <DataSourceInfo />

      <WaterHeightSimulatorModal
        isOpen={waterSimulatorOpen}
        onClose={() => setWaterSimulatorOpen(false)}
        selectedKelurahan={selectedKelurahan}
        onSelectKelurahanQuick={(nama) => {
          const found = daftarKelurahan.find((k) => k.nama_kelurahan.toLowerCase().includes(nama.toLowerCase()));
          if (found) handleSelectKelurahan(found);
        }}
      />

    </div>
  );
}
