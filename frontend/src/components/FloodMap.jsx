import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  CircleMarker,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  IconCompass,
  IconLocation,
  IconLayers,
  IconOpacity,
  IconSearch,
  IconClose,
  IconCompare,
  IconFlask,
  IconTarget,
} from "../Icons";
import FloodRiskLegend from "./FloodRiskLegend";
import {
  POSKO_EVAKUASI_MAKASSAR,
  KANAL_DAN_SUNGAI_MAKASSAR,
} from "../data/evakuasiDanKanal";
import {
  DAFTAR_FASILITAS_KRITIS,
  KATEGORI_FASILITAS,
} from "../data/fasilitasKritis";
import EvacuationRouteCard from "./EvacuationRouteCard";
import RiverBufferTool from "./RiverBufferTool";

// Fungsi Icon Khusus Posko Evakuasi
function createPoskoIcon(kategori) {
  const isHospital =
    kategori.toLowerCase().includes("kesehatan") ||
    kategori.toLowerCase().includes("sakit");
  const bg = isHospital ? "#DC2626" : "#16A34A";
  const emoji = isHospital ? "🏥" : "⛺";

  return L.divIcon({
    className: "posko-marker-icon-wrap",
    html: `<div style="
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: ${bg};
      border: 2.5px solid #FFFFFF;
      box-shadow: 0 4px 10px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      cursor: pointer;
    ">${emoji}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -16],
  });
}

// Fungsi Icon Khusus Fasilitas Kritis Kota Makassar
function createFacilityIcon(kategori) {
  let bg = "#176B65";
  let emoji = "🏢";
  if (kategori === "kesehatan") {
    bg = "#DC2626";
    emoji = "🏥";
  } else if (kategori === "komando") {
    bg = "#EA580C";
    emoji = "🚒";
  } else if (kategori === "ibadah") {
    bg = "#16A34A";
    emoji = "🕌";
  } else if (kategori === "spbu") {
    bg = "#0284C7";
    emoji = "⛽";
  }

  return L.divIcon({
    className: "facility-marker-icon-wrap",
    html: `<div style="
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: ${bg};
      border: 2px solid #FFFFFF;
      box-shadow: 0 3px 8px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      cursor: pointer;
    ">${emoji}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

// Fix icon bawaan Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const BASEMAPS = {
  standar: {
    label: "Peta Jalan (Standar)",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  satelit: {
    label: "Peta Satelit (Esri)",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    overlayUrl:
      "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    attribution:
      '&copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar',
  },
  topografi: {
    label: "Peta Topografi",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    attribution:
      '&copy; <a href="https://www.esri.com/">Esri</a>, HERE, Garmin, USGS',
  },
};

const RISK_COLORS = {
  rendah: "#2F855A",
  sedang: "#D69E2E",
  tinggi: "#DD6B20",
  sangat_tinggi: "#C53030",
  belum: "#94A3B8",
};

function MapResetFocus({ trigger }) {
  const map = useMap();
  useEffect(() => {
    if (trigger > 0) {
      map.flyTo([-5.1477, 119.4327], 12, { duration: 1.2 });
    }
  }, [trigger, map]);
  return null;
}

function SelectedFocus({ feature }) {
  const map = useMap();
  useEffect(() => {
    if (!feature || !feature.geometry) return;
    try {
      const leafletGeo = L.geoJSON(feature);
      const bounds = leafletGeo.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { maxZoom: 15, padding: [60, 60], duration: 1.2 });
      }
    } catch (_) {}
  }, [feature, map]);
  return null;
}

function UserLocationFocus({ location }) {
  const map = useMap();
  useEffect(() => {
    if (!location) return;
    try {
      map.flyTo(location, 14, { duration: 1.2 });
    } catch (_) {}
  }, [location, map]);
  return null;
}

// FITUR 6: Kontrol Pane & CSS ClipPath untuk Komparasi Peta Split Slider
function MapCompareController({ compareMode, comparePos }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    let rightPane = map.getPane("rightBasemapPane");
    if (!rightPane && compareMode) {
      rightPane = map.createPane("rightBasemapPane");
      rightPane.style.zIndex = "250";
    }

    const overlayPane = map.getPane("overlayPane");

    if (compareMode) {
      const clip = `inset(0 0 0 ${comparePos}%)`;
      if (rightPane) {
        rightPane.style.clipPath = clip;
        rightPane.style.webkitClipPath = clip;
      }
      if (overlayPane) {
        overlayPane.style.clipPath = clip;
        overlayPane.style.webkitClipPath = clip;
      }
    } else {
      if (rightPane) {
        rightPane.style.clipPath = "";
        rightPane.style.webkitClipPath = "";
      }
      if (overlayPane) {
        overlayPane.style.clipPath = "";
        overlayPane.style.webkitClipPath = "";
      }
    }
  }, [map, compareMode, comparePos]);

  return null;
}

export default function FloodMap({
  geojson,
  banjirData = [],
  elevasiData = [],
  hujanData = [],
  selectedKelurahan = null,
  onSelectKelurahan,
  search = "",
  onSearchChange,
  filter = "semua",
  onFilterChange,
  summary,
  // MODE SIMULASI PROPS
  isSimulation = false,
  simulationState = null,
  onOpenSimulation,
  onResetSimulation,
  // FITUR 2: JALUR EVAKUASI TERAMAN PROPS
  activeRoute = null,
  onClearRoute,
  onStartRouteToFacility,
  // FITUR 4: RADIUS LUAPAN KANAL BUFFER PROPS
  activeBufferRiver = "kanal-panampu",
  bufferRadius = 250,
  onChangeBufferRiver,
  onChangeBufferRadius,
  bufferToolOpen = false,
  onToggleBufferTool,
  // FITUR 6: FASILITAS KRITIS RADAR PROPS
  facilityCategory = "semua",
  onChangeFacilityCategory,
  publicMode = true,
}) {
  const [basemap, setBasemap] = useState("standar");
  const [layerOpacity, setLayerOpacity] = useState(0.55);
  const [basemapMenuOpen, setBasemapMenuOpen] = useState(false);
  const [opacityMenuOpen, setOpacityMenuOpen] = useState(false);
  const [facilityMenuOpen, setFacilityMenuOpen] = useState(false);
  const [resetCount, setResetCount] = useState(0);
  const [userLocation, setUserLocation] = useState(null);
  const [locatingUser, setLocatingUser] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  // Layer toggles
  const [showPosko, setShowPosko] = useState(true);
  const [showKanal, setShowKanal] = useState(true);

  // FITUR 6 (Slider Komparasi Peta)
  const [compareMode, setCompareMode] = useState(false);
  const [comparePos, setComparePos] = useState(50); // Posisi pembagi 5% - 95%
  const [isDragging, setIsDragging] = useState(false);
  const mapFrameRef = useRef(null);

  const handleStartDrag = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e) => {
      if (!mapFrameRef.current) return;
      const rect = mapFrameRef.current.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const offset = clientX - rect.left;
      const percentage = Math.min(Math.max((offset / rect.width) * 100, 5), 95);
      setComparePos(Number(percentage.toFixed(1)));
    };

    const handleStop = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleStop);
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleStop);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleStop);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleStop);
    };
  }, [isDragging]);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3500);
  };

  // Deteksi Geolocation GPS pengguna
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      showToast("Browser tidak mendukung geolokasi GPS");
      return;
    }
    setLocatingUser(true);
    showToast("Mendeteksi koordinat lokasi Anda...");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = [pos.coords.latitude, pos.coords.longitude];
        setUserLocation(coords);
        setLocatingUser(false);
        showToast("📍 Posisi GPS Anda berhasil ditemukan!");
      },
      () => {
        setLocatingUser(false);
        showToast("Gagal mendeteksi lokasi GPS perangkat");
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Lookup data cepat
  const banjirMap = useMemo(() => {
    const map = new Map();
    banjirData.forEach((item) => {
      if (item.kelurahan_id) map.set(item.kelurahan_id, item);
      if (item.nama_kelurahan) map.set(item.nama_kelurahan, item);
    });
    return map;
  }, [banjirData]);

  const elevasiMap = useMemo(() => {
    const map = new Map();
    elevasiData.forEach((item) => {
      if (item.kelurahan_id) map.set(item.kelurahan_id, item.elevasi_titik_m);
      if (item.nama_kelurahan) map.set(item.nama_kelurahan, item.elevasi_titik_m);
    });
    return map;
  }, [elevasiData]);

  const hujanMap = useMemo(() => {
    const map = new Map();
    hujanData.forEach((item) => {
      if (item.kelurahan_id) map.set(item.kelurahan_id, item.nilai_mm);
      if (item.nama_kelurahan) map.set(item.nama_kelurahan, item.nilai_mm);
    });
    return map;
  }, [hujanData]);

  // Evaluasi risiko fitur (mendukung mode simulasi dinamis)
  const getFeatureRisk = useCallback(
    (props) => {
      const id = props.id;
      const nama = props.nama_kelurahan;
      const b = banjirMap.get(id) || banjirMap.get(nama);
      const elev = elevasiMap.get(id) ?? elevasiMap.get(nama) ?? null;
      const rawHujan = hujanMap.get(id) ?? hujanMap.get(nama) ?? null;

      // JIKA MODE SIMULASI AKTIF: Hitung risiko dinamis berdasarkan parameter pengujian
      if (isSimulation && simulationState) {
        const simRain = simulationState.rainMm ?? 0;
        const simTide = simulationState.tideM ?? 0.45;
        const isCoastal = elev !== null && elev < 4.5;
        const isBasin = ["antang", "manggala", "tamalanrea", "tamangapa", "karunrung"].some((k) =>
          (nama || "").toLowerCase().includes(k)
        );

        let simTingkat = "rendah";
        if (simRain >= 120 || (simRain >= 70 && simTide >= 1.35) || (isCoastal && simTide >= 1.45)) {
          simTingkat = "sangat_tinggi";
        } else if (simRain >= 60 || (isBasin && simRain >= 40) || (isCoastal && simTide >= 1.15)) {
          simTingkat = "tinggi";
        } else if (simRain >= 25 || simTide >= 1.0) {
          simTingkat = "sedang";
        }

        return {
          tingkatKey: simTingkat,
          rawTingkat:
            simTingkat === "sangat_tinggi"
              ? "Bahaya Ekstrem (Simulasi)"
              : simTingkat === "tinggi"
              ? "Siaga Banjir (Simulasi)"
              : simTingkat === "sedang"
              ? "Waspada (Simulasi)"
              : "Aman (Simulasi)",
          elevasi: elev,
          hujan: simRain,
        };
      }

      // MODE REAL-TIME ASLI: Menggunakan data terverifikasi
      let tingkat = "belum";
      if (b && b.tingkat) {
        const norm = String(b.tingkat).toLowerCase();
        if (norm.includes("sangat") || norm.includes("ekstrem")) tingkat = "sangat_tinggi";
        else if (norm.includes("tinggi") || norm.includes("siaga")) tingkat = "tinggi";
        else if (norm.includes("sedang") || norm.includes("waspada")) tingkat = "sedang";
        else tingkat = "rendah";
      }

      return {
        tingkatKey: tingkat,
        rawTingkat: b?.tingkat || "Rendah",
        elevasi: elev,
        hujan: rawHujan,
        estimasiKedalamanCm: b?.estimasi_kedalaman_cm ?? null,
        kondisiBmkg: b?.kondisi_bmkg ?? null,
        waktuAnalisis: b?.waktu_analisis ?? null,
      };
    },
    [banjirMap, elevasiMap, hujanMap, isSimulation, simulationState]
  );

  // Filter geojson berdasarkan search dan filter kategori risiko
  const filteredGeojson = useMemo(() => {
    if (!geojson) return null;
    return {
      ...geojson,
      features: geojson.features.filter((f) => {
        const props = f.properties || {};
        const nama = String(props.nama_kelurahan || "").toLowerCase();
        const matchesSearch = !search || nama.includes(search.toLowerCase());

        if (!matchesSearch) return false;
        if (filter === "semua") return true;

        const { tingkatKey } = getFeatureRisk(props);
        return tingkatKey === filter;
      }),
    };
  }, [geojson, search, filter, getFeatureRisk]);

  // Styling polygon
  const featureStyle = useCallback(
    (feature) => {
      const props = feature.properties || {};
      const { tingkatKey } = getFeatureRisk(props);
      const isSelected = selectedKelurahan && selectedKelurahan.id === props.id;

      const fillColor = RISK_COLORS[tingkatKey] || RISK_COLORS.belum;

      if (isSelected) {
        return {
          color: "#176B65",
          weight: 3.5,
          opacity: 1,
          fillColor: fillColor,
          fillOpacity: Math.min(0.85, layerOpacity + 0.2),
        };
      }

      return {
        color: "#FFFFFF",
        weight: 1.5,
        opacity: 0.9,
        fillColor: fillColor,
        fillOpacity: layerOpacity,
      };
    },
    [getFeatureRisk, selectedKelurahan, layerOpacity]
  );

  // Event handler polygon
  const onEachFeature = useCallback(
    (feature, layer) => {
      const props = feature.properties || {};
      const { tingkatKey, rawTingkat, elevasi, hujan, estimasiKedalamanCm, kondisiBmkg, waktuAnalisis } = getFeatureRisk(props);
      const isSelected = selectedKelurahan && selectedKelurahan.id === props.id;

      layer.on({
        click: () => {
          try {
            layer.closeTooltip();
            layer.unbindTooltip();
          } catch (_) {}
          onSelectKelurahan({
            ...props,
            feature,
            tingkat: rawTingkat,
            elevasi_m: elevasi,
            hujan_mm: hujan,
            estimasi_kedalaman_cm: estimasiKedalamanCm,
            kondisi_bmkg: kondisiBmkg,
            waktu_analisis: waktuAnalisis,
          });
        },
        mouseover: (e) => {
          if (!selectedKelurahan || selectedKelurahan.id !== props.id) {
            e.target.setStyle({ weight: 2.5, color: "#176B65" });
          }
        },
        mouseout: (e) => {
          if (!selectedKelurahan || selectedKelurahan.id !== props.id) {
            e.target.setStyle({ weight: 1.5, color: "#FFFFFF" });
          }
        },
      });

      if (!isSelected) {
        const badgeColor = RISK_COLORS[tingkatKey] || "#64748B";
        layer.bindTooltip(
          `<div style="display:flex; align-items:center; gap:6px; font-family: inherit; font-size: 11px; font-weight: 700; color: #172B3A;">
            <span style="width:7px; height:7px; border-radius:50%; background-color:${badgeColor}; flex-shrink:0;"></span>
            <span>${props.nama_kelurahan}</span>
            <span style="font-size:10px; font-weight:500; color:#64748B;">(${rawTingkat})</span>
          </div>`,
          { sticky: true, className: "clean-map-tooltip", direction: "top", offset: [0, -6] }
        );
      } else {
        layer.unbindTooltip();
      }
    },
    [getFeatureRisk, onSelectKelurahan, selectedKelurahan]
  );

  return (
    <div id="peta" className="flood-map-wrapper">
      {/* Search & Filter Toolbar di Atas Peta */}
      <div className="map-toolbar">
        <div className="map-search-box">
          <IconSearch size={16} color="#64748B" />
          <input
            type="text"
            placeholder="Ketik nama kelurahan Makassar..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="map-search-input"
            aria-label="Cari kelurahan pada peta"
          />
          {search && (
            <button
              type="button"
              className="map-search-clear"
              onClick={() => onSearchChange("")}
              aria-label="Hapus filter nama"
            >
              <IconClose size={13} color="#64748B" />
            </button>
          )}
        </div>

        {/* Filter Chips Berdasarkan Kategori Risiko */}
        <div className="map-filter-chips">
          <button
            type="button"
            className={`filter-chip ${filter === "semua" ? "active" : ""}`}
            onClick={() => onFilterChange("semua")}
          >
            Semua ({summary.total})
          </button>
          <button
            type="button"
            className={`filter-chip chip-aman ${filter === "rendah" ? "active" : ""}`}
            onClick={() => onFilterChange("rendah")}
          >
            <span className="chip-dot" style={{ backgroundColor: "#2F855A" }} />
            Aman ({summary.rendah})
          </button>
          <button
            type="button"
            className={`filter-chip chip-waspada ${filter === "sedang" ? "active" : ""}`}
            onClick={() => onFilterChange("sedang")}
          >
            <span className="chip-dot" style={{ backgroundColor: "#D69E2E" }} />
            Waspada ({summary.sedang})
          </button>
          <button
            type="button"
            className={`filter-chip chip-siaga ${filter === "tinggi" ? "active" : ""}`}
            onClick={() => onFilterChange("tinggi")}
          >
            <span className="chip-dot" style={{ backgroundColor: "#DD6B20" }} />
            Siaga ({summary.tinggi})
          </button>
          <button
            type="button"
            className={`filter-chip chip-bahaya ${filter === "sangat_tinggi" ? "active" : ""}`}
            onClick={() => onFilterChange("sangat_tinggi")}
          >
            <span className="chip-dot" style={{ backgroundColor: "#C53030" }} />
            Bahaya ({summary.sangat_tinggi})
          </button>

          <span className="chips-divider">|</span>

          {/* Toggle Layer Posko */}
          <button
            type="button"
            className={`filter-chip ${showPosko ? "active-layer" : ""}`}
            onClick={() => {
              setShowPosko((p) => !p);
              showToast(!showPosko ? "📍 Layer Posko Evakuasi aktif" : "Layer Posko disembunyikan");
            }}
            title="Tampilkan / Sembunyikan Titik Posko Evakuasi Makassar"
          >
            ⛺ Posko ({POSKO_EVAKUASI_MAKASSAR.length})
          </button>

          {/* Toggle Layer Kanal */}
          {!publicMode && <button
            type="button"
            className={`filter-chip ${showKanal ? "active-layer" : ""}`}
            onClick={() => {
              setShowKanal((p) => !p);
              showToast(!showKanal ? "🌊 Layer Kanal & Sungai aktif" : "Layer Kanal disembunyikan");
            }}
            title="Tampilkan / Sembunyikan Jaringan Kanal & Sungai Utama"
          >
            🌊 Kanal & Sungai ({KANAL_DAN_SUNGAI_MAKASSAR.features.length})
          </button>}

          {/* FITUR 4: TOOL BUFFER SEMPADAN KANAL */}
          {!publicMode && <button
            type="button"
            className={`filter-chip ${bufferToolOpen ? "active-buffer-btn" : ""}`}
            onClick={() => {
              if (onToggleBufferTool) onToggleBufferTool();
              showToast(!bufferToolOpen ? "🎯 Analisis Radius Sempadan Kanal Aktif" : "Analisis Sempadan Ditutup");
            }}
            title="Analisis radius bahaya luapan sempadan kanal dan sungai"
          >
            <IconTarget size={13} color={bufferToolOpen ? "#FFFFFF" : "#EA580C"} />
            <span>Sempadan Kanal ({bufferRadius}m)</span>
          </button>}

          {/* FITUR 6 (REKOMENDASI USER): FASILITAS KRITIS RADAR */}
          <div className="map-btn-dropdown-wrap" style={{ display: "inline-block" }}>
            <button
              type="button"
              className={`filter-chip ${facilityCategory !== "none" ? "active-facility-btn" : ""}`}
              onClick={() => setFacilityMenuOpen((p) => !p)}
              title="Filter fasilitas kritis: Rumah Sakit, BPBD/Damkar, Tempat Ibadah Tinggi, SPBU"
            >
              <span>🏢 Fasilitas Kritis</span>
              <span style={{ fontSize: "10px", marginLeft: "2px" }}>▼</span>
            </button>

            {facilityMenuOpen && (
              <div className="map-dropdown-menu facility-dropdown">
                <span className="dropdown-title">Kategori Fasilitas Kritis:</span>
                {KATEGORI_FASILITAS.map((kat) => (
                  <button
                    key={kat.id}
                    type="button"
                    className={`dropdown-item ${facilityCategory === kat.id ? "active" : ""}`}
                    onClick={() => {
                      if (onChangeFacilityCategory) onChangeFacilityCategory(kat.id);
                      setFacilityMenuOpen(false);
                      showToast(`Filter Fasilitas: ${kat.label}`);
                    }}
                  >
                    <span>{kat.icon} {kat.label}</span>
                    {facilityCategory === kat.id && <span>✓</span>}
                  </button>
                ))}
                <button
                  type="button"
                  className={`dropdown-item ${facilityCategory === "none" ? "active" : ""}`}
                  onClick={() => {
                    if (onChangeFacilityCategory) onChangeFacilityCategory("none");
                    setFacilityMenuOpen(false);
                    showToast("Fasilitas kritis disembunyikan");
                  }}
                >
                  <span>🚫 Sembunyikan Fasilitas</span>
                  {facilityCategory === "none" && <span>✓</span>}
                </button>
              </div>
            )}
          </div>

          {/* FITUR 6 (SEBELUMNYA): TOGGLE KOMPARASI SATELIT */}
          {!publicMode && <button
            type="button"
            className={`filter-chip chip-compare-toggle ${compareMode ? "active-compare" : ""}`}
            onClick={() => {
              setCompareMode((p) => {
                const next = !p;
                showToast(next ? "🔄 Mode Komparasi Satelit Aktif" : "Mode Komparasi Dinonaktifkan");
                return next;
              });
            }}
            title="Bandingkan citra satelit resolusi tinggi vs zona risiko banjir dengan slider pemisah"
          >
            <IconCompare size={13} color={compareMode ? "#FFFFFF" : "#0284C7"} />
            <span>Komparasi Satelit</span>
          </button>}

          {/* MODE SIMULASI BUTTON DI TOOLBAR */}
          {!publicMode && onOpenSimulation && (
            <button
              type="button"
              className={`filter-chip chip-sim-toggle ${isSimulation ? "active-sim" : ""}`}
              onClick={onOpenSimulation}
              title="Buka Pengaturan Mode Simulasi Bencana (Kustom)"
            >
              <IconFlask size={13} color={isSimulation ? "#FFFFFF" : "#0284C7"} />
              <span>{isSimulation ? "🧪 Simulasi Aktif" : "🧪 Mode Simulasi"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Kontainer Peta Leaflet */}
      <div className={`leaflet-map-frame ${compareMode ? "in-compare-mode" : ""}`} ref={mapFrameRef}>
        {geojson ? (
          <MapContainer
            center={[-5.1477, 119.4327]}
            zoom={12}
            scrollWheelZoom={true}
            zoomControl={false}
            style={{ width: "100%", height: "100%" }}
          >
            <MapCompareController compareMode={compareMode} comparePos={comparePos} />

            {compareMode ? (
              <>
                <TileLayer
                  key="compare-satelit-base"
                  attribution={BASEMAPS.satelit.attribution}
                  url={BASEMAPS.satelit.url}
                  maxZoom={19}
                />
                <TileLayer
                  key="compare-topo-right"
                  pane="rightBasemapPane"
                  attribution={BASEMAPS.standar.attribution}
                  url={BASEMAPS.standar.url}
                  maxZoom={19}
                />
              </>
            ) : (
              <>
                <TileLayer
                  key={basemap}
                  attribution={BASEMAPS[basemap].attribution}
                  url={BASEMAPS[basemap].url}
                  maxZoom={19}
                />
                {BASEMAPS[basemap].overlayUrl && (
                  <TileLayer
                    key={`${basemap}-overlay`}
                    url={BASEMAPS[basemap].overlayUrl}
                    maxZoom={19}
                  />
                )}
              </>
            )}

            {filteredGeojson && (
              <GeoJSON
                key={`geojson-${filter}-${search}-${layerOpacity}-${selectedKelurahan?.id}-${isSimulation ? JSON.stringify(simulationState) : "real"}`}
                data={filteredGeojson}
                style={featureStyle}
                onEachFeature={onEachFeature}
              />
            )}

            <SelectedFocus feature={selectedKelurahan?.feature} />
            <UserLocationFocus location={userLocation} />
            <MapResetFocus trigger={resetCount} />

            {/* FITUR 4: DYNAMIC BUFFER ZONE SEMPADAN KANAL */}
            {activeBufferRiver &&
              (() => {
                const feat = KANAL_DAN_SUNGAI_MAKASSAR.features.find(
                  (f) => f.properties.id === activeBufferRiver
                );
                if (!feat) return null;
                const coords = feat.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

                return (
                  <React.Fragment key={`buffer-overlay-${activeBufferRiver}-${bufferRadius}`}>
                    {/* Sabuk Bahaya Luapan Buffer Zone */}
                    <Polyline
                      positions={coords}
                      pathOptions={{
                        color: "#EF4444",
                        weight: Math.min(65, Math.max(16, bufferRadius / 8)),
                        opacity: 0.35,
                        lineCap: "round",
                        lineJoin: "round",
                      }}
                    />
                    {/* Garis Pusat Sungai Berdenyut */}
                    <Polyline
                      positions={coords}
                      pathOptions={{
                        color: "#DC2626",
                        weight: 3.5,
                        dashArray: "8, 6",
                        opacity: 0.9,
                      }}
                    />
                  </React.Fragment>
                );
              })()}

            {/* LAYER JARINGAN KANAL & SUNGAI UTAMA */}
            {showKanal && (
              <GeoJSON
                key="makassar-waterways"
                data={KANAL_DAN_SUNGAI_MAKASSAR}
                style={(f) => ({
                  color: f.properties.color || "#0284C7",
                  weight: f.properties.weight || 4.5,
                  opacity: 0.9,
                  lineCap: "round",
                  lineJoin: "round",
                })}
                onEachFeature={(feat, layer) => {
                  const p = feat.properties;
                  layer.bindTooltip(
                    `<div style="font-family: inherit; font-size: 11px; font-weight: 700; color: #0369A1;">
                      🌊 ${p.nama} <span style="font-size: 10px; font-weight: 500; color: #64748B;">(${p.jenis})</span>
                    </div>`,
                    { sticky: true, className: "clean-map-tooltip", direction: "top" }
                  );
                  layer.on({
                    click: () => {
                      if (onChangeBufferRiver) onChangeBufferRiver(p.id);
                      showToast(`Analisis sempadan ${p.nama} (${bufferRadius}m)`);
                    },
                  });
                }}
              />
            )}

            {/* FITUR 2: LAYER JALUR EVAKUASI TERAMAN (ANIMATED POLYLINE) */}
            {activeRoute && activeRoute.waypoints && (
              <React.Fragment key={`route-poly-${activeRoute.waypoints.length}`}>
                <Polyline
                  positions={activeRoute.waypoints}
                  pathOptions={{
                    color: "#059669",
                    weight: 6,
                    opacity: 0.95,
                    dashArray: "10, 8",
                    lineCap: "round",
                  }}
                />
                {/* Marker Titik Awal */}
                <Marker
                  position={activeRoute.waypoints[0]}
                  icon={L.divIcon({
                    className: "route-pin-icon",
                    html: `<div style="background:#0F172A; color:#FFFFFF; font-size:10px; font-weight:800; padding:3px 8px; border-radius:12px; border:2px solid #FFFFFF; box-shadow:0 2px 6px rgba(0,0,0,0.3); white-space:nowrap;">📍 Mulai</div>`,
                    iconSize: [60, 22],
                    iconAnchor: [30, 22],
                  })}
                />
                {/* Marker Posko Tujuan */}
                <Marker
                  position={activeRoute.waypoints[activeRoute.waypoints.length - 1]}
                  icon={L.divIcon({
                    className: "route-pin-icon",
                    html: `<div style="background:#059669; color:#FFFFFF; font-size:10px; font-weight:800; padding:3px 8px; border-radius:12px; border:2px solid #FFFFFF; box-shadow:0 2px 6px rgba(0,0,0,0.3); white-space:nowrap;">⛺ Posko Aman</div>`,
                    iconSize: [85, 22],
                    iconAnchor: [42, 22],
                  })}
                />
              </React.Fragment>
            )}

            {/* TITIK POSKO EVAKUASI RESMI */}
            {showPosko &&
              POSKO_EVAKUASI_MAKASSAR.map((posko) => (
                <Marker
                  key={posko.id}
                  position={[posko.latitude, posko.longitude]}
                  icon={createPoskoIcon(posko.kategori)}
                >
                  <Popup className="clean-posko-popup">
                    <div style={{ fontFamily: "inherit", fontSize: "12px", minWidth: "220px", maxWidth: "270px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: "9999px",
                            background: posko.kategori.includes("Kesehatan") || posko.kategori.includes("Sakit")
                              ? "#FEE2E2"
                              : "#DCFCE7",
                            color: posko.kategori.includes("Kesehatan") || posko.kategori.includes("Sakit")
                              ? "#DC2626"
                              : "#16A34A",
                          }}
                        >
                          {posko.kategori}
                        </span>
                        <span style={{ fontSize: "10px", color: "#64748B" }}>{posko.status}</span>
                      </div>
                      <strong style={{ fontSize: "14px", color: "#172B3A", display: "block", marginBottom: "2px" }}>
                        {posko.nama}
                      </strong>
                      <span style={{ fontSize: "11px", color: "#64748B", display: "block", marginBottom: "6px" }}>
                        📍 {posko.alamat} (Kec. {posko.kecamatan})
                      </span>
                      <div
                        style={{
                          fontSize: "11px",
                          color: "#1E293B",
                          background: "#F8FAFC",
                          padding: "6px 8px",
                          borderRadius: "6px",
                          border: "1px solid #E2E8F0",
                          marginBottom: "8px",
                        }}
                      >
                        <div><strong>Kapasitas:</strong> ± {posko.kapasitas} Jiwa</div>
                        <div style={{ marginTop: "2px" }}><strong>Kontak:</strong> {posko.kontak}</div>
                      </div>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${posko.latitude},${posko.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            flex: 1,
                            textAlign: "center",
                            background: "#176B65",
                            color: "#FFFFFF",
                            padding: "6px 10px",
                            borderRadius: "6px",
                            fontSize: "11px",
                            fontWeight: 700,
                            textDecoration: "none",
                            display: "block",
                          }}
                        >
                          🗺️ Rute Google Maps
                        </a>
                        <a
                          href="tel:112"
                          style={{
                            textAlign: "center",
                            background: "#DC2626",
                            color: "#FFFFFF",
                            padding: "6px 10px",
                            borderRadius: "6px",
                            fontSize: "11px",
                            fontWeight: 700,
                            textDecoration: "none",
                            display: "block",
                          }}
                        >
                          📞 112
                        </a>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}

            {/* FITUR 6: LAYER FASILITAS KRITIS RADAR */}
            {facilityCategory !== "none" &&
              DAFTAR_FASILITAS_KRITIS.filter(
                (f) => facilityCategory === "semua" || f.kategori === facilityCategory
              ).map((f) => (
                <Marker
                  key={f.id}
                  position={[f.latitude, f.longitude]}
                  icon={createFacilityIcon(f.kategori)}
                >
                  <Popup className="clean-posko-popup">
                    <div style={{ fontFamily: "inherit", fontSize: "12px", minWidth: "220px", maxWidth: "280px" }}>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: "9999px",
                          background: "#E0F2FE",
                          color: "#0369A1",
                          display: "inline-block",
                          marginBottom: "4px",
                        }}
                      >
                        {f.kategoriLabel}
                      </span>
                      <strong style={{ fontSize: "14px", color: "#172B3A", display: "block" }}>{f.nama}</strong>
                      <span style={{ fontSize: "11px", color: "#64748B", display: "block", marginBottom: "6px" }}>
                        📍 {f.alamat} ({f.kecamatan})
                      </span>
                      <div
                        style={{
                          fontSize: "11px",
                          background: "#F8FAFC",
                          padding: "6px 8px",
                          borderRadius: "6px",
                          border: "1px solid #E2E8F0",
                          marginBottom: "8px",
                        }}
                      >
                        <div><strong>Elevasi:</strong> {f.elevasi}</div>
                        <div><strong>Kapasitas:</strong> {f.kapasitas}</div>
                        <div><strong>Kontak:</strong> {f.kontak}</div>
                        <div style={{ fontSize: "10px", color: "#64748B", marginTop: "3px" }}>
                          <strong>Layanan:</strong> {f.layanan.slice(0, 3).join(", ")}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          type="button"
                          onClick={() => {
                            if (onStartRouteToFacility) onStartRouteToFacility(f);
                          }}
                          style={{
                            flex: 1,
                            background: "#176B65",
                            color: "#FFFFFF",
                            border: "none",
                            padding: "6px 8px",
                            borderRadius: "6px",
                            fontSize: "11px",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          🚶‍♂️ Rute Evakuasi ke Sini
                        </button>
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${f.latitude},${f.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            background: "#F1F5F9",
                            color: "#1E293B",
                            padding: "6px 8px",
                            borderRadius: "6px",
                            fontSize: "11px",
                            fontWeight: 700,
                            textDecoration: "none",
                          }}
                        >
                          🗺️ Maps
                        </a>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}

            {/* Titik Lokasi GPS Pengguna */}
            {userLocation && (
              <CircleMarker
                center={userLocation}
                radius={8}
                pathOptions={{
                  color: "#FFFFFF",
                  weight: 3,
                  fillColor: "#0284C7",
                  fillOpacity: 1,
                }}
              >
                <Popup>
                  <strong>📍 Posisi Perangkat Anda</strong>
                </Popup>
              </CircleMarker>
            )}
          </MapContainer>
        ) : (
          <div className="map-loading-state">
            <span>⏳ Sedang memuat batas 153 kelurahan Kota Makassar...</span>
          </div>
        )}

        {/* FLOATING TOP BANNER MODE SIMULASI */}
        {isSimulation && simulationState && (
          <div className="map-sim-top-banner" role="status">
            <div className="sim-top-info">
              <span className="sim-pulse-dot" />
              <strong>MODE SIMULASI PENGUJIAN AKTIF</strong>
              <span className="sim-sub-text">
                🌧️ {simulationState.rainMm} mm &bull; 🌊 +{simulationState.tideM.toFixed(2)} m &bull; Skenario: {simulationState.nama || simulationState.activePreset}
              </span>
            </div>
            <div className="sim-top-actions">
              <button
                type="button"
                className="sim-top-btn-edit"
                onClick={onOpenSimulation}
              >
                ⚙️ Atur Parameter
              </button>
              <button
                type="button"
                className="sim-top-btn-reset"
                onClick={onResetSimulation}
                title="Kembali ke mode data real-time"
              >
                ✕ Reset Real-Time
              </button>
            </div>
          </div>
        )}

        {/* FLOATING KARTU RUTE EVAKUASI TERAMAN */}
        {activeRoute && (
          <div className="map-floating-route-wrap">
            <EvacuationRouteCard
              routeData={activeRoute}
              originName={activeRoute.originName}
              targetPosko={activeRoute.targetPosko}
              onClose={onClearRoute}
              isSimulation={isSimulation}
            />
          </div>
        )}

        {/* FLOATING KARTU TOOL BUFFER SEMPADAN KANAL */}
        {bufferToolOpen && (
          <div className="map-floating-buffer-wrap">
            <RiverBufferTool
              selectedRiverId={activeBufferRiver}
              onSelectRiver={onChangeBufferRiver}
              bufferRadius={bufferRadius}
              onChangeRadius={onChangeBufferRadius}
              onHighlightKelurahan={(nama) => {
                onSearchChange(nama);
              }}
            />
          </div>
        )}

        {/* Floating Quick Action Buttons di Kanan Atas Peta */}
        <div className="map-floating-controls">
          {/* Tombol Basemap Picker */}
          <div className="map-btn-dropdown-wrap">
            <button
              type="button"
              className={`map-circle-btn ${basemapMenuOpen ? "active" : ""}`}
              onClick={() => {
                setBasemapMenuOpen((p) => !p);
                setOpacityMenuOpen(false);
              }}
              title="Pilihan Jenis Peta (Basemap)"
              aria-label="Pilih jenis basemap"
            >
              <IconLayers size={18} color="#172B3A" />
            </button>

            {basemapMenuOpen && (
              <div className="map-dropdown-menu">
                <span className="dropdown-title">Pilih Basemap:</span>
                {Object.entries(BASEMAPS).map(([key, bm]) => (
                  <button
                    key={`bm-${key}`}
                    type="button"
                    className={`dropdown-item ${basemap === key ? "active" : ""}`}
                    onClick={() => {
                      setBasemap(key);
                      setBasemapMenuOpen(false);
                      showToast(`Basemap diubah ke: ${bm.label}`);
                    }}
                  >
                    <span>{bm.label}</span>
                    {basemap === key && <span>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tombol Pengatur Transparansi Opacity */}
          {!publicMode && <div className="map-btn-dropdown-wrap">
            <button
              type="button"
              className={`map-circle-btn ${opacityMenuOpen ? "active" : ""}`}
              onClick={() => {
                setOpacityMenuOpen((p) => !p);
                setBasemapMenuOpen(false);
              }}
              title="Atur Transparansi Zona Kelurahan"
              aria-label="Atur transparansi layer"
            >
              <IconOpacity size={18} color="#172B3A" />
            </button>

            {opacityMenuOpen && (
              <div className="map-dropdown-menu opacity-menu">
                <div className="opacity-header">
                  <span>Transparansi Zona:</span>
                  <strong style={{ color: "#176B65" }}>{Math.round(layerOpacity * 100)}%</strong>
                </div>
                <input
                  type="range"
                  min="10"
                  max="90"
                  step="5"
                  value={Math.round(layerOpacity * 100)}
                  onChange={(e) => setLayerOpacity(Number(e.target.value) / 100)}
                  className="opacity-slider"
                />
                <div className="opacity-presets">
                  <button type="button" onClick={() => setLayerOpacity(0.25)}>Terang (25%)</button>
                  <button type="button" onClick={() => setLayerOpacity(0.55)}>Sedang (55%)</button>
                  <button type="button" onClick={() => setLayerOpacity(0.8)}>Pekat (80%)</button>
                </div>
              </div>
            )}
          </div>}

          {/* Tombol Reset Kamera Peta ke Seluruh Kota Makassar */}
          <button
            type="button"
            className="map-circle-btn"
            onClick={() => {
              setResetCount((c) => c + 1);
              showToast("Kamera peta di-reset ke seluruh Kota Makassar");
            }}
            title="Reset Posisi Peta ke Makassar"
            aria-label="Reset kamera peta ke Makassar"
          >
            <IconCompass size={18} color="#172B3A" />
          </button>

          {/* Tombol Deteksi Lokasi GPS Pengguna */}
          <button
            type="button"
            className={`map-circle-btn ${locatingUser ? "loading" : ""}`}
            onClick={handleDetectLocation}
            title="Deteksi Lokasi GPS Saya"
            aria-label="Deteksi posisi GPS saya"
          >
            <IconLocation size={18} color="#172B3A" />
          </button>
        </div>

        {/* Legenda Kategori Risiko di Kiri Bawah Peta */}
        <FloodRiskLegend summary={summary} />

        {/* FITUR 6: OVERLAY SLIDER KOMPARASI PETA (SPLIT-SCREEN) */}
        {compareMode && (
          <>
            <div className="compare-badge compare-badge-left">
              🛰️ Citra Satelit Fisik (Esri)
            </div>
            <div className="compare-badge compare-badge-right">
              ⚠️ Zona Risiko Banjir WebGIS
            </div>

            <div
              className={`map-compare-divider ${isDragging ? "dragging" : ""}`}
              style={{ left: `${comparePos}%` }}
              onMouseDown={handleStartDrag}
              onTouchStart={handleStartDrag}
            >
              <div className="compare-divider-line" />
              <div
                className="compare-divider-handle"
                title="Tahan dan geser ke kiri/kanan untuk membandingkan citra satelit vs risiko banjir"
              >
                <span className="knob-arrow">◀</span>
                <span className="knob-label">Geser</span>
                <span className="knob-arrow">▶</span>
              </div>
            </div>

            <div className="compare-floating-pill">
              <span className="compare-pill-text">
                Bandingkan foto satelit atap/permukiman warga vs model zona bahaya banjir
              </span>
              <button
                type="button"
                className="compare-pill-close-btn"
                onClick={() => setCompareMode(false)}
              >
                ✕ Keluar Komparasi
              </button>
            </div>
          </>
        )}

        {/* Toast Notifikasi Ringan */}
        {toastMsg && (
          <div className="map-toast-pill" role="status">
            <span>{toastMsg}</span>
          </div>
        )}
      </div>
    </div>
  );
}
