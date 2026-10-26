import React, { useState } from "react";
import { IconShield, IconSearch, IconClose, IconMobile, IconLaptop, IconFlask } from "../Icons";

export default function AppHeader({
  search = "",
  onSearchChange,
  daftarKelurahan = [],
  onSelectKelurahan,
  viewMode = "laptop",
  onToggleMode,
  onOpenWaterSimulator,
  onOpenSimulation,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Filter daftar kelurahan saat mengetik
  const searchResults = search.trim().length >= 2
    ? daftarKelurahan.filter((k) =>
        k.nama_kelurahan.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 6)
    : [];

  const handleNavClick = (targetId) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(targetId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <header className="app-header">
      <div className="header-container">
        {/* Logo Brand & Wordmark */}
        <div className="header-brand" onClick={() => handleNavClick("peta")}>
          <div className="brand-logo-badge">
            <IconShield size={20} color="#FFFFFF" />
          </div>
          <div className="brand-text-block">
            <div className="brand-title">
              Jene<span>Bosi</span>
            </div>
            <div className="brand-tagline">Kesiapsiagaan Banjir Makassar</div>
          </div>
        </div>

        {/* Quick Search Kelurahan di Header */}
        <div className="header-search-wrapper">
          <div className={`header-search-bar ${isSearchFocused ? "focused" : ""}`}>
            <IconSearch size={16} color="#64748B" />
            <input
              type="text"
              placeholder="Cari kelurahan Makassar..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
              aria-label="Cari nama kelurahan di Makassar"
            />
            {search && (
              <button
                type="button"
                className="header-search-clear"
                onClick={() => onSearchChange("")}
                aria-label="Hapus pencarian"
              >
                <IconClose size={14} color="#64748B" />
              </button>
            )}
          </div>

          {/* Dropdown Hasil Pencarian */}
          {isSearchFocused && searchResults.length > 0 && (
            <div className="header-search-dropdown">
              {searchResults.map((k) => (
                <div
                  key={`search-res-${k.id}`}
                  className="search-dropdown-item"
                  onMouseDown={() => {
                    onSelectKelurahan(k);
                    onSearchChange(k.nama_kelurahan);
                    handleNavClick("peta");
                  }}
                >
                  <span className="search-item-name">{k.nama_kelurahan}</span>
                  <span className="search-item-badge">Makassar</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Desktop Navigation Links */}
        <nav className="header-nav-desktop" aria-label="Navigasi Utama">
          <button type="button" onClick={() => handleNavClick("peta")} className="nav-link">
            Peta Banjir
          </button>
          <button type="button" onClick={() => handleNavClick("panduan")} className="nav-link">
            Panduan Siaga
          </button>
        </nav>

        {onOpenSimulation && (
          <button type="button" className="header-simulation-btn" onClick={onOpenSimulation} title="Buka simulasi skenario banjir">
            <IconFlask size={15} color="#FFFFFF" />
            <span>Simulasi</span>
          </button>
        )}


        {/* Tombol Beralih Mode HP */}
        {onToggleMode && (
          <button
            type="button"
            className="header-mode-toggle-btn"
            onClick={onToggleMode}
            title={viewMode === "laptop" ? "Beralih ke Tampilan Handphone" : "Beralih ke Tampilan Laptop"}
          >
            {viewMode === "laptop" ? (
              <>
                <IconLaptop size={15} color="#176B65" />
                <span>Tampilan: Laptop</span>
              </>
            ) : (
              <>
                <IconMobile size={15} color="#176B65" />
                <span>Tampilan: HP</span>
              </>
            )}
          </button>
        )}

        {/* Mobile Hamburger Toggle Button */}
        <button
          type="button"
          className="header-mobile-toggle"
          onClick={() => setMobileMenuOpen((p) => !p)}
          aria-label={mobileMenuOpen ? "Tutup menu" : "Buka menu"}
        >
          {mobileMenuOpen ? <IconClose size={22} color="#172B3A" /> : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#172B3A" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="header-mobile-drawer">
          <button type="button" onClick={() => handleNavClick("peta")} className="mobile-nav-link">
            Peta Banjir
          </button>
          {onOpenWaterSimulator && (
            <button type="button" onClick={() => { setMobileMenuOpen(false); onOpenWaterSimulator(); }} className="mobile-nav-link">
              Simulator Ketinggian Air
            </button>
          )}
          {onOpenSimulation && (
            <button type="button" onClick={() => { setMobileMenuOpen(false); onOpenSimulation(); }} className="mobile-nav-link">
              Simulasi Skenario Banjir
            </button>
          )}
          <button type="button" onClick={() => handleNavClick("cuaca")} className="mobile-nav-link">
            Prakiraan Cuaca BMKG
          </button>
          <button type="button" onClick={() => handleNavClick("panduan")} className="mobile-nav-link">
            Panduan Kesiapsiagaan
          </button>
          <button type="button" onClick={() => handleNavClick("tentang")} className="mobile-nav-link">
            Tentang Data & Metodologi
          </button>
        </div>
      )}
    </header>
  );
}
