import React from "react";
import {
  IconCompass,
  IconLayers,
  IconShield,
  IconCloudRain,
  IconWaves,
  IconTarget,
  IconSliders,
  IconFlask,
  IconBookOpen,
  IconInfo,
  IconChevronRight,
} from "../Icons";

export const SIDEBAR_ITEMS = [
  { id: "ikhtisar", label: "Ringkasan & Wilayah", icon: "📊" },
  { id: "posko", label: "Posko & Titik Evakuasi", icon: "⛺" },
  { id: "fasilitas", label: "Fasilitas Kritis", icon: "🏢" },
  { id: "cuaca", label: "Prakiraan Cuaca BMKG", icon: "🌤️" },
  { id: "pasut", label: "Pasang Surut Selat Makassar", icon: "🚢" },
  { id: "simulasi", label: "Simulasi Skenario", icon: "🧪" },
  { id: "panduan", label: "Panduan Siaga Warga", icon: "📋" },
  { id: "tentang", label: "Tentang Sumber Data", icon: "ℹ️" },
];

export default function DockedSidebar({
  activeMenu,
  onSelectMenu,
  isCollapsed,
  onToggleCollapse,
}) {
  return (
    <aside className={`docked-left-sidebar ${isCollapsed ? "collapsed" : ""}`}>
      {/* Tombol Collapse / Expand di Paling Atas */}
      <button
        type="button"
        className="sidebar-collapse-toggle-btn"
        onClick={onToggleCollapse}
        title={isCollapsed ? "Perluas Menu Sidebar" : "Ciutkan Sidebar (Full Peta)"}
        aria-label="Toggle Sidebar"
      >
        <span className="toggle-arrow">{isCollapsed ? "❯" : "❮"}</span>
      </button>

      {/* Daftar Tombol Navigasi Fitur Vertikal */}
      <nav className="sidebar-nav-icons" aria-label="Navigasi Fitur GIS">
        {SIDEBAR_ITEMS.map((item) => {
          const isActive = activeMenu === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`sidebar-dock-icon-btn ${isActive ? "active" : ""}`}
              onClick={() => onSelectMenu(item.id)}
              title={item.label}
              aria-label={item.label}
            >
              <span className="dock-emoji-icon">{item.icon}</span>
              {!isCollapsed && <span className="dock-label-text">{item.label}</span>}
              {isActive && <span className="dock-active-indicator" />}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
