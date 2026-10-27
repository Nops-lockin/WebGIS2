import React, { useState, useEffect, useMemo, useCallback } from "react";
import AppHeader from "./components/AppHeader";
import JeneBosiLogo from "./components/JeneBosiLogo";
import DockedSidebar from "./components/DockedSidebar";
import SidebarFeatureDrawer from "./components/SidebarFeatureDrawer";
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
import RiverBufferTool from "./components/RiverBufferTool";
import { generateJalurEvakuasi } from "./utils/evacuationRouting";
import { POSKO_EVAKUASI_MAKASSAR, KANAL_DAN_SUNGAI_MAKASSAR } from "./data/evakuasiDanKanal";
import { KATEGORI_FASILITAS, DAFTAR_FASILITAS_KRITIS } from "./data/fasilitasKritis";
import {
  IconShield,
  IconSearch,
  IconClose,
  IconLaptop,
  IconCompass,
  IconInfo,
} from "./Icons";

// Kosong berarti API berada pada domain yang sama (deployment satu layanan).
const API = (import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? "http://127.0.0.1:8000" : "")).replace(/\/$/, "");

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
      waktu_lokal: (item.waktu_lokal || item.datetime || item.waktu || null)?.replace?.("T", " ") || null,
      suhu_c: item.suhu_c ?? item.suhu ?? item.temperature ?? null,
      kelembapan_persen: item.kelembapan_persen ?? item.kelembapan ?? item.humidity ?? null,
      kondisi: item.kondisi || item.weather_desc || item.cuaca || "Berawan",
    }));
}

export default function App() {
  // Tema: "dark" | "light"
  const [theme, setTheme] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("jenebosi_theme") || "dark";
    }
    return "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("jenebosi_theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((curr) => (curr === "dark" ? "light" : "dark"));
  }, []);

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
  const [isSearchFocusedMobile, setIsSearchFocusedMobile] = useState(false);
  const [filter, setFilter] = useState("semua"); // "semua" | "rendah" | "sedang" | "tinggi" | "sangat_tinggi"
  const [selectedKelurahan, setSelectedKelurahan] = useState(null);

  const [prakiraan, setPrakiraan] = useState([]);
  const [loadingPrakiraan, setLoadingPrakiraan] = useState(false);
  const [errorPrakiraan, setErrorPrakiraan] = useState("");
  const [forecastRequestVersion, setForecastRequestVersion] = useState(0);

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
  const [focusedPosko, setFocusedPosko] = useState(null);

  // STATE BARU: DOCKED SIDEBAR LAYOUT SEPERTI REFERENSI GAMBAR
  const [activeSidebarMenu, setActiveSidebarMenu] = useState(null); // null | "ikhtisar" | "layer_kerawanan" | "posko" | "fasilitas" | "kanal_buffer" | "cuaca" | "pasut" | "simulasi" | "simulator_air" | "panduan" | "tentang"
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true); // Default ringkas icon-only

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

  // 2. Ambil prakiraan BMKG saat kelurahan dipilih.
  // Jika layanan langsung BMKG mengembalikan daftar kosong, gunakan salinan
  // prakiraan terakhir di database agar panel tidak tampak kosong bagi warga.
  useEffect(() => {
    const kodeWilayah = selectedKelurahan?.kode_wilayah;

    if (!kodeWilayah) {
      setPrakiraan([]);
      setLoadingPrakiraan(false);
      setErrorPrakiraan(selectedKelurahan ? "Kode wilayah kelurahan tidak tersedia." : "");
      return;
    }

    const controller = new AbortController();
    setLoadingPrakiraan(true);
    setErrorPrakiraan("");
    setPrakiraan([]);

    async function loadPrakiraan() {
      const sumberPrakiraan = [
        `${API}/api/bmkg/prakiraan/${kodeWilayah}`,
        `${API}/api/prakiraan/${kodeWilayah}`,
      ];

      try {
        for (const url of sumberPrakiraan) {
          const response = await fetch(url, { signal: controller.signal });
          if (!response.ok) continue;

          const data = await response.json();
          const daftar = normalisasiPrakiraan(data);
          if (daftar.length > 0) {
            setPrakiraan(daftar);
            return;
          }
        }

        setErrorPrakiraan("Prakiraan BMKG untuk kelurahan ini belum tersedia. Coba perbarui beberapa saat lagi.");
      } catch (err) {
        if (err.name !== "AbortError") {
          setErrorPrakiraan("Gagal terhubung ke layanan prakiraan BMKG.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingPrakiraan(false);
        }
      }
    }

    loadPrakiraan();

    return () => controller.abort();
  }, [selectedKelurahan?.kode_wilayah, forecastRequestVersion]);

  const handleRefreshPrakiraan = useCallback(() => {
    setForecastRequestVersion((version) => version + 1);
  }, []);

  // Responsive auto-detection saat ukuran layar berubah
  useEffect(() => {
    let timer;
    const handleResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const isMobileScreen = window.innerWidth < 768;
        setViewMode((current) => {
          if (isMobileScreen && current === "laptop" && window.innerWidth < 640) return "mobile";
          if (!isMobileScreen && current === "mobile" && window.innerWidth >= 1024) return "laptop";
          return current;
        });
      }, 200);
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(timer);
    };
  }, []);

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

  // Autocomplete pencarian cepat di mobile
  const searchResultsMobile = useMemo(() => {
    if (!search || search.trim().length < 2) return [];
    return daftarKelurahan
      .filter((k) => k.nama_kelurahan.toLowerCase().includes(search.toLowerCase()))
      .slice(0, 6);
  }, [daftarKelurahan, search]);

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
        const isCoastal = e < 4.5 || ["mariso", "tallo", "buloa", "gusung", "camba berua", "ujung tanah"].some((k) => nama.includes(k));
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

  // Handler memilih kelurahan dari dropdown / search / klik polygon
  const handleSelectKelurahan = useCallback(
    (item) => {
      setActiveSidebarMenu(null); // Otomatis tutup drawer menu samping saat kelurahan dipilih agar fokus ke peta
      const feat = geojson?.features.find((f) => f.properties.id === item.id);
      const b = banjir.find((x) => x.kelurahan_id === item.id || x.nama_kelurahan === item.nama_kelurahan);
      const lowerName = String(item.nama_kelurahan || "").toLowerCase();
      const isCoastal = ["mariso", "tallo", "buloa", "gusung", "camba berua", "ujung tanah", "tanjung merdeka"].some((k) => lowerName.includes(k));
      const rain = simulationState.rainMm ?? 0;
      const tide = simulationState.tideM ?? 0.45;
      const baseIndex = Number(b?.indeks_kerawanan) || 250;
      const depth = Math.max(0, Math.min(150, Math.round(((rain / 180) * 75 + ((tide - 0.3) / 1.5) * 30 + Math.max(0, Math.min(20, (baseIndex - 180) / 12)) + (isCoastal ? 10 : 0)) / 5) * 5));
      const simulatedLevel = rain >= 120 || (rain >= 70 && tide >= 1.35) || (isCoastal && tide >= 1.45)
        ? "Bahaya Ekstrem (Simulasi)"
        : rain >= 60 || (isCoastal && tide >= 1.15)
          ? "Siaga Banjir (Simulasi)"
          : rain >= 25 || tide >= 1.0
            ? "Waspada (Simulasi)"
            : "Aman (Simulasi)";

      setSelectedKelurahan({
        id: item.id,
        nama_kelurahan: item.nama_kelurahan,
        kode_wilayah: item.kode_wilayah || b?.kode_wilayah,
        kecamatan: b?.kecamatan || "",
        tingkat: isSimulation ? simulatedLevel : (b?.tingkat || "Rendah"),
        estimasi_kedalaman_cm: isSimulation ? depth : (b?.estimasi_kedalaman_cm ?? null),
        kondisi_bmkg: isSimulation ? `Skenario: ${simulationState.nama || "Kustom"}` : (b?.kondisi_bmkg ?? null),
        waktu_analisis: isSimulation ? new Date().toISOString() : (b?.waktu_analisis ?? null),
        feature: feat,
      });
      setActiveSidebarMenu(null); // Otomatis tutup drawer fitur agar tidak tumpang tindih
    },
    [geojson, banjir, isSimulation, simulationState]
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
                <JeneBosiLogo size={24} />
              </div>
              <strong className="mobile-brand-title">JeneBosi <span>(JB)</span></strong>
            </div>

            {/* Quick Search Input dengan Autocomplete */}
            <div className="mobile-search-wrapper-rel">
              <div className="mobile-search-pill">
                <IconSearch size={14} color="#64748B" />
                <input
                  type="text"
                  placeholder="Cari kelurahan..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onFocus={() => setIsSearchFocusedMobile(true)}
                  onBlur={() => setTimeout(() => setIsSearchFocusedMobile(false), 200)}
                  className="mobile-search-input"
                />
                {search && (
                  <button type="button" onClick={() => setSearch("")} className="mobile-search-clear">
                    <IconClose size={12} color="#64748B" />
                  </button>
                )}
              </div>

              {/* Dropdown Hasil Pencarian Mobile */}
              {isSearchFocusedMobile && searchResultsMobile.length > 0 && (
                <div className="mobile-search-dropdown">
                  {searchResultsMobile.map((k) => (
                    <div
                      key={`m-search-res-${k.id}`}
                      className="mobile-search-item"
                      onMouseDown={() => {
                        handleSelectKelurahan(k);
                        setSearch(k.nama_kelurahan);
                        setIsSearchFocusedMobile(false);
                      }}
                    >
                      <strong>{k.nama_kelurahan}</strong>
                      <span>Pilih wilayah</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Theme Toggle Mobile */}
            <button
              type="button"
              className="mode-toggle-chip"
              onClick={toggleTheme}
              title={theme === "dark" ? "Ganti ke Tema Terang" : "Ganti ke Tema Gelap"}
            >
              <span>{theme === "dark" ? "🌙" : "☀️"}</span>
            </button>

            {/* Tombol Beralih ke Mode Laptop */}
            <button
              type="button"
              className="mode-toggle-chip"
              onClick={() => setViewMode("laptop")}
              title="Beralih ke Tampilan Laptop"
            >
              <IconLaptop size={14} color="var(--brand-primary)" />
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
              className={`mobile-chip chip-scenario ${isSimulation ? "active-scenario" : ""}`}
              onClick={() => setSimulationModalOpen(true)}
            >
              🧪 {isSimulation ? "Skenario Aktif" : "Simulasi"}
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
              onClick={() => setMobileModalActive("posko")}
            >
              ⛺ Posko Evakuasi ({POSKO_EVAKUASI_MAKASSAR.length})
            </button>
            <button
              type="button"
              className={`mobile-chip chip-feature ${facilityCategory !== "none" ? "active-scenario" : ""}`}
              onClick={() => setMobileModalActive("fasilitas")}
            >
              🏢 Fasilitas ({facilityCategory === "semua" ? "Semua" : facilityCategory === "none" ? "Nonaktif" : facilityCategory})
            </button>
            <button
              type="button"
              className="mobile-chip chip-feature"
              onClick={() => setMobileModalActive("panduan_darurat")}
            >
              🛡️ Darurat 112
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
            focusedPosko={focusedPosko}
          />
        </div>

        {/* Interactive Bottom Sheet saat Kelurahan Dipilih */}
        {selectedKelurahan && (
          <MobileBottomSheet
            selected={selectedKelurahan}
            onClose={() => setSelectedKelurahan(null)}
            prakiraan={prakiraan}
            loadingPrakiraan={loadingPrakiraan}
            errorPrakiraan={errorPrakiraan}
            onRefreshPrakiraan={handleRefreshPrakiraan}
            onOpenSimulator={() => setMobileModalActive("simulasi_kedalaman")}
            onShowRoute={handleShowRoute}
            badge={badge}
          />
        )}

        {/* Modal Drawer Posko Evakuasi di HP */}
        <MobileDrawerModal
          isOpen={mobileModalActive === "posko"}
          onClose={() => setMobileModalActive(null)}
          title="Posko & Titik Evakuasi Resmi"
        >
          <div className="drawer-panel-inner" style={{ padding: "6px 0" }}>
            <p className="drawer-intro-text">
              Daftar <strong>{POSKO_EVAKUASI_MAKASSAR.length} Posko Resmi</strong> dan fasilitas evakuasi warga. Ketuk untuk langsung fokus dan zoom ke titik posko di peta:
            </p>
            <div className="drawer-items-scroll">
              {POSKO_EVAKUASI_MAKASSAR.map((p) => (
                <div
                  key={`m-posko-${p.id}`}
                  className="drawer-card-item clickable-posko-card"
                  onClick={() => {
                    setFocusedPosko(p);
                    setMobileModalActive(null);
                  }}
                  title="Ketuk untuk melihat langsung di peta"
                >
                  <div className="drawer-card-title-row">
                    <strong>{p.nama}</strong>
                    <span className="drawer-chip-badge">{p.kategori}</span>
                  </div>
                  <span className="drawer-card-sub">📍 {p.alamat} (Kec. {p.kecamatan})</span>
                  <div className="drawer-card-meta">
                    <span>Kapasitas: ±{p.kapasitas} Jiwa</span>
                    <span>Kontak: {p.kontak}</span>
                  </div>
                  <div className="drawer-card-btn-row">
                    <button
                      type="button"
                      className="drawer-action-btn primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFocusedPosko(p);
                        setMobileModalActive(null);
                      }}
                    >
                      📍 Fokus ke Posko di Peta
                    </button>
                    <button
                      type="button"
                      className="drawer-action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (selectedKelurahan) {
                          handleShowRoute(selectedKelurahan, p);
                        } else {
                          handleShowRoute(daftarKelurahan[0], p);
                        }
                        setMobileModalActive(null);
                      }}
                    >
                      🗺️ Rute
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </MobileDrawerModal>

        {/* Modal Drawer Fitur Pendukung di HP */}
        <MobileDrawerModal
          isOpen={mobileModalActive === "panduan_darurat"}
          onClose={() => setMobileModalActive(null)}
          title="Panduan Tanggap Darurat Banjir & Call Center 112"
        >
          <CitizenSafetyGuide />
        </MobileDrawerModal>

        <MobileDrawerModal
          isOpen={mobileModalActive === "fasilitas"}
          onClose={() => setMobileModalActive(null)}
          title="Filter Fasilitas Kritis Kota Makassar"
        >
          <div className="mobile-facility-list" style={{ padding: "8px 0" }}>
            <p className="drawer-intro-text">
              Pilih kategori fasilitas yang ingin ditampilkan pada peta:
            </p>
            {KATEGORI_FASILITAS.map((kat) => (
              <button
                key={kat.id}
                type="button"
                className={`drawer-option-btn ${facilityCategory === kat.id ? "active" : ""}`}
                onClick={() => {
                  setFacilityCategory(kat.id);
                  setMobileModalActive(null);
                }}
                style={{ marginBottom: "8px" }}
              >
                <span>{kat.icon} {kat.label}</span>
                {facilityCategory === kat.id && <span>✓ Aktif</span>}
              </button>
            ))}
            <button
              type="button"
              className={`drawer-option-btn ${facilityCategory === "none" ? "active" : ""}`}
              onClick={() => {
                setFacilityCategory("none");
                setMobileModalActive(null);
              }}
              style={{
                marginTop: "4px",
                borderColor: facilityCategory === "none" ? "#EF4444" : "rgba(255, 255, 255, 0.12)",
                color: facilityCategory === "none" ? "#EF4444" : "inherit"
              }}
            >
              <span>🚫 Sembunyikan Semua Fasilitas</span>
              {facilityCategory === "none" && <span>✓ Tersembunyi</span>}
            </button>
          </div>
        </MobileDrawerModal>
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
  // RENDER 2: MODE LAPTOP / DESKTOP (FULL MAP-FIRST CARTOGRAPHIC DASHBOARD)
  // Layout mengikuti referensi gambar: Fullscreen Map + Floating Header + Docked Sidebar Navigasi
  // =========================================================================
  return (
    <div className="webgis-app-root full-screen-dashboard">
      {/* 1. FLOATING TOP HEADER DENGAN SEARCH & FILTER PILLS */}
      <AppHeader
        search={search}
        onSearchChange={setSearch}
        daftarKelurahan={daftarKelurahan}
        onSelectKelurahan={handleSelectKelurahan}
        viewMode={viewMode}
        onToggleMode={() => setViewMode("mobile")}
        theme={theme}
        onToggleTheme={toggleTheme}
        filter={filter}
        onFilterChange={setFilter}
        summary={summary}
      />

      {/* 2. DOCKED SIDEBAR DI KIRI (Vertikal Icon Navigasi persis seperti Gambar Referensi) */}
      <DockedSidebar
        activeMenu={activeSidebarMenu}
        onSelectMenu={(menuId) => {
          setActiveSidebarMenu((current) => {
            const next = current === menuId ? null : menuId;
            if (next) {
              setSelectedKelurahan(null); // Otomatis tutup panel detail kelurahan agar tidak tumpang tindih
            }
            return next;
          });
        }}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((c) => !c)}
      />

      {/* 3. SIDEBAR FEATURE DRAWER (Panel Samping yang Muncul Ketika Icon Menu Dipilih) */}
      <SidebarFeatureDrawer
        activeMenu={activeSidebarMenu}
        onClose={() => setActiveSidebarMenu(null)}
        title={
          activeSidebarMenu === "ikhtisar" ? "📊 Ringkasan Risiko Kota Makassar" :
          activeSidebarMenu === "layer_kerawanan" ? "⚠️ Filter Layer Kerawanan" :
          activeSidebarMenu === "posko" ? "⛺ Posko & Titik Pengungsian" :
          activeSidebarMenu === "fasilitas" ? "🏢 Fasilitas Kritis Makassar" :
          activeSidebarMenu === "kanal_buffer" ? "🌊 Kanal & Sempadan Luapan" :
          activeSidebarMenu === "cuaca" ? "🌤️ Dinamika Prakiraan Cuaca BMKG" :
          activeSidebarMenu === "pasut" ? "🚢 Pasang Surut Laut (Stasiun Paotere)" :
          activeSidebarMenu === "simulasi" ? "🧪 Mode Simulasi Bencana Banjir" :
          activeSidebarMenu === "simulator_air" ? "📏 Simulator Ketinggian Genangan Air" :
          activeSidebarMenu === "panduan" ? "📋 Panduan Kesiapsiagaan & 112" :
          activeSidebarMenu === "tentang" ? "ℹ️ Tentang Data & Metodologi" : "Menu"
        }
      >
        {activeSidebarMenu === "ikhtisar" && (
          <div className="drawer-panel-inner">
            <p className="drawer-intro-text">
              Pantauan geospasial kerawanan banjir dari <strong>153 kelurahan</strong> di Kota Makassar.
            </p>
            <div className="drawer-stats-grid">
              <div className="drawer-stat-card border-green">
                <span>Aman</span>
                <strong>{summary.rendah}</strong>
              </div>
              <div className="drawer-stat-card border-amber">
                <span>Waspada</span>
                <strong>{summary.sedang}</strong>
              </div>
              <div className="drawer-stat-card border-orange">
                <span>Siaga</span>
                <strong>{summary.tinggi}</strong>
              </div>
              <div className="drawer-stat-card border-red">
                <span>Bahaya</span>
                <strong>{summary.sangat_tinggi}</strong>
              </div>
            </div>

            <h4 className="drawer-section-heading">Pilihan Cepat Kelurahan:</h4>
            <div className="drawer-quick-pills">
              {["Antang", "Manggala", "Tamalanrea", "Panakkukang", "Mariso", "Buloa", "Tallo"].map((nama) => (
                <button
                  key={`drawer-p-${nama}`}
                  type="button"
                  className="drawer-pill-btn"
                  onClick={() => {
                    const found = daftarKelurahan.find((k) => k.nama_kelurahan.toLowerCase() === nama.toLowerCase());
                    if (found) {
                      handleSelectKelurahan(found);
                      setActiveSidebarMenu(null); // Tutup drawer agar user melihat peta
                    }
                  }}
                >
                  {nama}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeSidebarMenu === "posko" && (
          <div className="drawer-panel-inner">
            <p className="drawer-intro-text">
              Daftar <strong>{POSKO_EVAKUASI_MAKASSAR.length} Posko Resmi</strong> dan fasilitas evakuasi warga. Klik untuk fokus langsung ke titik posko di peta:
            </p>
            <div className="drawer-items-scroll">
              {POSKO_EVAKUASI_MAKASSAR.map((p) => (
                <div
                  key={p.id}
                  className="drawer-card-item clickable-posko-card"
                  onClick={() => {
                    setFocusedPosko(p);
                    setActiveSidebarMenu(null); // Tutup drawer langsung ke peta dan zoom ke posko
                  }}
                  title="Klik untuk melihat langsung di peta"
                >
                  <div className="drawer-card-title-row">
                    <strong>{p.nama}</strong>
                    <span className="drawer-chip-badge">{p.kategori}</span>
                  </div>
                  <span className="drawer-card-sub">📍 {p.alamat} (Kec. {p.kecamatan})</span>
                  <div className="drawer-card-meta">
                    <span>Kapasitas: ±{p.kapasitas} Jiwa</span>
                    <span>Kontak: {p.kontak}</span>
                  </div>
                  <div className="drawer-card-btn-row">
                    <button
                      type="button"
                      className="drawer-action-btn primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFocusedPosko(p);
                        setActiveSidebarMenu(null);
                      }}
                    >
                      📍 Fokus ke Posko di Peta
                    </button>
                    <button
                      type="button"
                      className="drawer-action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (selectedKelurahan) {
                          handleShowRoute(selectedKelurahan, p);
                        } else {
                          handleShowRoute(daftarKelurahan[0], p);
                        }
                        setActiveSidebarMenu(null);
                      }}
                    >
                      🗺️ Buat Rute Evakuasi
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSidebarMenu === "fasilitas" && (
          <div className="drawer-panel-inner">
            <p className="drawer-intro-text">Pilih kategori fasilitas publik yang ditampilkan di peta:</p>
            <div className="drawer-options-list">
              {KATEGORI_FASILITAS.map((kat) => (
                <button
                  key={kat.id}
                  type="button"
                  className={`drawer-option-btn ${facilityCategory === kat.id ? "active" : ""}`}
                  onClick={() => setFacilityCategory(kat.id)}
                >
                  <span>{kat.icon} {kat.label}</span>
                  {facilityCategory === kat.id && <span>✓</span>}
                </button>
              ))}
              <button
                type="button"
                className={`drawer-option-btn ${facilityCategory === "none" ? "active" : ""}`}
                onClick={() => setFacilityCategory("none")}
              >
                <span>🚫 Sembunyikan Fasilitas</span>
                {facilityCategory === "none" && <span>✓</span>}
              </button>
            </div>
          </div>
        )}

        {activeSidebarMenu === "cuaca" && (
          <div className="drawer-panel-inner">
            <RainfallInsight
              prakiraanList={prakiraan}
              selectedKelurahan={selectedKelurahan}
              hujanTerbaru={0}
            />
          </div>
        )}

        {activeSidebarMenu === "pasut" && (
          <div className="drawer-panel-inner">
            <TideMonitorWidget
              onFilterCoastal={() => {
                setSearch("Mariso");
                setActiveSidebarMenu(null);
              }}
            />
          </div>
        )}

        {activeSidebarMenu === "simulasi" && (
          <div className="drawer-panel-inner">
            <p className="drawer-intro-text">
              Uji ketahanan wilayah Kota Makassar dengan skenario hujan lebat dan pasang air laut kustom:
            </p>
            <button
              type="button"
              className="drawer-action-btn primary"
              onClick={() => {
                setSimulationModalOpen(true);
                setActiveSidebarMenu(null);
              }}
            >
              ⚙️ Buka Pengendali Simulasi
            </button>
            {isSimulation && (
              <button
                type="button"
                className="drawer-action-btn danger"
                style={{ marginTop: 8 }}
                onClick={handleResetSimulation}
              >
                ✕ Matikan Simulasi (Kembali ke Real-Time)
              </button>
            )}
          </div>
        )}

        {activeSidebarMenu === "panduan" && (
          <div className="drawer-panel-inner">
            <CitizenSafetyGuide />
            <div style={{ marginTop: 16 }}>
              <PreparednessChecklist />
            </div>
          </div>
        )}

        {activeSidebarMenu === "tentang" && (
          <div className="drawer-panel-inner">
            <DataSourceInfo />
          </div>
        )}
      </SidebarFeatureDrawer>

      {/* 4. AREA PETA LEAFLET FULLSCREEN (FOKUS UTAMA) */}
      <main className="fullscreen-map-canvas">
        <FloodMap
          geojson={geojson}
          banjirData={banjir}
          selectedKelurahan={selectedKelurahan}
          onSelectKelurahan={(kel) => {
            setSelectedKelurahan(kel);
            if (kel) {
              setActiveSidebarMenu(null); // Otomatis tutup drawer aktif saat poligon kelurahan di peta diklik
            }
          }}
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
          bufferToolOpen={bufferToolOpen || activeSidebarMenu === "kanal_buffer"}
          onToggleBufferTool={() => setBufferToolOpen((p) => !p)}
          // FACILITY PROPS
          facilityCategory={facilityCategory}
          onChangeFacilityCategory={setFacilityCategory}
          publicMode
          focusedPosko={focusedPosko}
        />

        {/* 5. FLOATING POPUP / CONTEXT DRAWER KETIKA KELURAHAN DIPILIH */}
        {selectedKelurahan && (
          <div className="floating-selected-overlay">
            <SelectedAreaPanel
              selected={selectedKelurahan}
              onClose={() => setSelectedKelurahan(null)}
              prakiraan={prakiraan}
              loadingPrakiraan={loadingPrakiraan}
              errorPrakiraan={errorPrakiraan}
              onRefreshPrakiraan={handleRefreshPrakiraan}
              onShowRoute={handleShowRoute}
              isSimulation={isSimulation}
              simulationState={simulationState}
            />
          </div>
        )}

        {/* Floating Quick Action Button di Bawah Peta: "Info Lainnya ↓" persis seperti di Gambar Referensi */}
        <div className="map-bottom-center-action">
          <button
            type="button"
            className="bottom-info-pill-btn"
            onClick={() => {
              setActiveSidebarMenu((curr) => (curr ? null : "ikhtisar"));
            }}
          >
            <span>{activeSidebarMenu ? "Tutup Panel ↑" : "Info Lainnya ↓"}</span>
          </button>
        </div>
      </main>

      {/* Modal Pengendali Simulasi */}
      <SimulationController
        isOpen={simulationModalOpen}
        onClose={() => setSimulationModalOpen(false)}
        isSimulation={isSimulation}
        onToggleMode={setIsSimulation}
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
