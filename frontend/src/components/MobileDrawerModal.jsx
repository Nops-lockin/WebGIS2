import React from "react";
import { IconClose } from "../Icons";

export default function MobileDrawerModal({
  isOpen = false,
  onClose,
  title = "",
  children,
}) {
  if (!isOpen) return null;

  return (
    <div className="mobile-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="mobile-modal-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Tutup jendela"
          >
            <IconClose size={20} color="#F8FAFC" />
          </button>
        </div>

        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}
