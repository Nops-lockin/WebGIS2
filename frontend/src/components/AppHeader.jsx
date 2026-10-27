import React, { useState } from "react";
import JeneBosiLogo from "./JeneBosiLogo";
import { IconSearch, IconClose, IconMobile, IconLaptop, IconFlask, IconSun } from "../Icons";

export default function AppHeader({
  search = "",
  onSearchChange,
  daftarKelurahan = [],
  onSelectKelurahan,
  viewMode = "laptop",
  onToggleMode,
  theme = "dark",
  onToggleTheme,
  filter = "semua",
  onFilterChange,
  summary = { total: 153, rendah: 0, sedang: 0, tinggi: 0, sangat_tinggi: 0 },
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Filter daftar kelurahan saat mengetik
  const searchResults = search.trim().length >= 2
    ? daftarKelurahan.filter((k) =>
        k.nama_kelurahan.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 8)
    : [];

  return (
    <header className="app-header glass-header">
      <div className="header-container">
        {/* Logo Brand & Wordmark */}
        <div className="header-brand">
          <div className="brand-logo-badge">
            <JeneBosiLogo size={28} />
          </div>
          <div className="brand-text-block">
            <div className="brand-title">
              Jene<span>Bosi</span>
            </div>
            <div className="brand-tagline">WebGIS Banjir Makassar</div>
          </div>
        </div>

        {/* Quick Search Kelurahan di Header (Pusat seperti Referensi) */}
        <div className="header-search-wrapper">
          <div className={`header-search-bar ${isSearchFocused ? "focused" : ""}`}>
            <IconSearch size={16} color="var(--text-secondary)" />
            <input
              type="text"
              placeholder="Cari kelurahan di Kota Makassar..."
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
                <IconClose size={14} color="var(--text-secondary)" />
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
                  }}
                >
                  <span className="search-item-name">{k.nama_kelurahan}</span>
                  <span className="search-item-badge">Makassar</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Action: Theme Switcher & View Mode Toggle */}
        <div className="header-right-controls">
          {onToggleTheme && (
            <button
              type="button"
              className="theme-toggle-switch"
              onClick={onToggleTheme}
              title={theme === "dark" ? "Ganti ke Mode Terang" : "Ganti ke Mode Gelap"}
              aria-label="Ganti tema tampilan"
            >
              <span className={`theme-toggle-indicator ${theme}`}>
                {theme === "dark" ? "🌙" : "☀️"}
              </span>
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
                  <IconLaptop size={15} color="var(--brand-primary)" />
                  <span>Laptop</span>
                </>
              ) : (
                <>
                  <IconMobile size={15} color="var(--brand-primary)" />
                  <span>HP</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Horizontal Category Chips Bar tepat di bawah search seperti di gambar referensi */}
      {onFilterChange && (
        <div className="header-category-chips-bar">
          <button
            type="button"
            className={`cat-pill ${filter === "semua" ? "active" : ""}`}
            onClick={() => onFilterChange("semua")}
          >
            Semua ({summary.total})
          </button>
          <button
            type="button"
            className={`cat-pill cat-aman ${filter === "rendah" ? "active" : ""}`}
            onClick={() => onFilterChange("rendah")}
          >
            Aman ({summary.rendah})
          </button>
          <button
            type="button"
            className={`cat-pill cat-waspada ${filter === "sedang" ? "active" : ""}`}
            onClick={() => onFilterChange("sedang")}
          >
            Waspada ({summary.sedang})
          </button>
          <button
            type="button"
            className={`cat-pill cat-siaga ${filter === "tinggi" ? "active" : ""}`}
            onClick={() => onFilterChange("tinggi")}
          >
            Siaga ({summary.tinggi})
          </button>
          <button
            type="button"
            className={`cat-pill cat-bahaya ${filter === "sangat_tinggi" ? "active" : ""}`}
            onClick={() => onFilterChange("sangat_tinggi")}
          >
            Bahaya Ekstrem ({summary.sangat_tinggi})
          </button>
        </div>
      )}
    </header>
  );
}
