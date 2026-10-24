import React from "react";
import FloodDepthSimulator from "./FloodDepthSimulator";
import { IconClose, IconSliders } from "../Icons";

export default function WaterHeightSimulatorModal({ isOpen, onClose, selectedKelurahan, onSelectKelurahanQuick }) {
  if (!isOpen) return null;

  return (
    <div className="water-simulator-overlay" role="dialog" aria-modal="true" aria-labelledby="water-simulator-title" onClick={onClose}>
      <div className="water-simulator-modal" onClick={(event) => event.stopPropagation()}>
        <div className="water-simulator-modal-header">
          <div>
            <span className="water-simulator-eyebrow">ALAT EDUKASI WARGA</span>
            <h2 id="water-simulator-title"><IconSliders size={21} color="#176B65" /> Simulator Ketinggian Air</h2>
            <p>Bandingkan ketinggian genangan dengan ukuran orang dewasa dan anak-anak.</p>
          </div>
          <button type="button" className="water-simulator-close" onClick={onClose} aria-label="Tutup simulator">
            <IconClose size={20} color="#172B3A" />
          </button>
        </div>
        <div className="water-simulator-modal-body">
          <FloodDepthSimulator
            defaultDepth={35}
            selectedKelurahan={selectedKelurahan}
            isSimulation={false}
            simulationState={null}
            onSelectKelurahanQuick={onSelectKelurahanQuick}
          />
        </div>
      </div>
    </div>
  );
}
