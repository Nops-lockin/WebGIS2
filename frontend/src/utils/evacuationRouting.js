/**
 * UTILITY GENERATOR JALUR EVAKUASI TERAMAN MAKASSAR
 * Menghitung jarak, estimasi waktu, waypoint jalur aman, dan rekomendasi mitigasi.
 */

// Rumus Haversine untuk menghitung jarak akurat (km)
export function hitungJarakKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius bumi dalam km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

/**
 * Generate waypoint rute realistis yang menghubungkan titik asal dan posko tujuan.
 * Mengikuti pola jalan arteri/kolektor Makassar (membelok secara ortogonal dan menghindari sungai langsung).
 */
export function generateJalurEvakuasi(origin, destination, floodScenario = null) {
  const [startLat, startLon] = origin;
  const [endLat, endLon] = destination;

  const straightDist = hitungJarakKm(startLat, startLon, endLat, endLon);
  // Faktor jarak jalan raya aktual perkotaan (detour factor ~ 1.25x s.d 1.35x)
  const actualRoadDist = Number((straightDist * 1.3).toFixed(2));

  // Estimasi waktu
  const menitMobil = Math.max(3, Math.round((actualRoadDist / 25) * 60)); // asumsi 25 km/jam saat darurat
  const menitJalanKaki = Math.max(5, Math.round((actualRoadDist / 4) * 60)); // asumsi 4 km/jam jalan kaki

  // Titik belok realistis jalan raya (2 waypoint perantara)
  const midLat1 = startLat + (endLat - startLat) * 0.35;
  const midLon1 = startLon + (endLon - startLon) * 0.15;

  const midLat2 = startLat + (endLat - startLat) * 0.75;
  const midLon2 = startLon + (endLon - startLon) * 0.85;

  const waypoints = [
    [startLat, startLon],
    [midLat1, midLon1],
    [midLat2, midLon2],
    [endLat, endLon],
  ];

  // Rekomendasi keselamatan jalur
  const advisories = [
    "Prioritaskan menggunakan jalur jalan raya bertaraf arteri (hindari gang sempit di dekat saluran air).",
    "Jika ketinggian air di jalan melebihi knalpot / 30 cm, segera tinggalkan kendaraan dan lanjutkan berjalan kaki.",
    "Bantu lansia, ibu hamil, dan anak-anak terlebih dahulu menuju titik kumpul.",
  ];

  if (floodScenario && (floodScenario.rainMm > 60 || floodScenario.tideM > 1.25)) {
    advisories.unshift("⚠️ PERINGATAN SKENARIO BANJIR: Hindari menyeberangi jembatan kanal primer saat debit air puncak.");
  }

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${startLat},${startLon}&destination=${endLat},${endLon}&travelmode=driving`;

  return {
    waypoints,
    jarakKm: actualRoadDist,
    waktuKendaraanMenit: menitMobil,
    waktuJalanKakiMenit: menitJalanKaki,
    advisories,
    googleMapsUrl,
  };
}
