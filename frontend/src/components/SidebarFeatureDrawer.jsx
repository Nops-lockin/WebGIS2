import React from "react";
import { IconClose } from "../Icons";

export default function SidebarFeatureDrawer({
  activeMenu,
  onClose,
  title,
  children,
}) {
  if (!activeMenu) return null;

  return (
    <div className="sidebar-feature-drawer" role="dialog" aria-label={title}>
      <div className="drawer-header-strip">
        <h3 className="drawer-title">{title}</h3>
        <button
          type="button"
          className="drawer-close-btn"
          onClick={onClose}
          aria-label="Tutup panel samping"
          title="Tutup panel"
        >
          <IconClose size={16} color="var(--text-secondary)" />
        </button>
      </div>
      <div className="drawer-scroll-content">
        {children}
      </div>
    </div>
  );
}
