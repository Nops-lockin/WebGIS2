import React from "react";
import { getDepthImpact } from "./FloodDepthVisualization";
import FloodDepthVisualization from "./FloodDepthVisualization";

export default function FloodDepthEstimate({ depthCm, weatherCondition, updatedAt }) {
  const depth = Number(depthCm) || 0;
  const impact = getDepthImpact(depth);

  return (
    <section className="depth-estimate-card" aria-label="Estimasi kedalaman genangan">
      <div className="depth-estimate-header">
        <div>
          <span className="depth-estimate-eyebrow">PERKIRAAN KONDISI GENANGAN</span>
          <h3>{depth} cm</h3>
          <span className="depth-estimate-meter">{(depth / 100).toFixed(2)} meter</span>
        </div>
        <div className="depth-estimate-water" aria-hidden="true">
          <span style={{ height: `${Math.max(12, Math.min(100, depth))}%` }} />
        </div>
      </div>

      <div className="depth-estimate-impact" style={{ borderLeftColor: impact.badgeColor, background: impact.bgBadge }}>
        <strong style={{ color: impact.badgeColor }}>{impact.label}</strong>
        <p>{impact.advice}</p>
      </div>

      <div className="depth-estimate-character" aria-label="Perbandingan tinggi air dengan karakter manusia">
        <FloodDepthVisualization depthCm={depth} showHeader={false} showImpactCards={false} />
      </div>
      {weatherCondition && <span className="depth-estimate-update">Kondisi cuaca: {weatherCondition}</span>}
      {updatedAt && <span className="depth-estimate-update">Terakhir diperbarui: {new Date(updatedAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</span>}
    </section>
  );
}
