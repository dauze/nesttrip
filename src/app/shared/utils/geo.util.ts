/**
 * Distance à vol d'oiseau entre 2 points GPS (formule de Haversine, rayon
 * terrestre moyen R=6371000m) — gratuite (aucun appel réseau), extraite de
 * `TripDayMapComponent.haversineDistance` (calcul de dézoom caméra) pour être
 * réutilisée côté sélection auto du mode de trajet (voir `travel-mode.util.ts`).
 */
export function haversineDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
