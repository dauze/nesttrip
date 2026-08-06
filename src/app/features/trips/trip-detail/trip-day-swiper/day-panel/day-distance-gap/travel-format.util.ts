/** Ex: 850 → "850 m" | 2500 → "2,5 km" | 12000 → "12 km" (pas de décimale superflue au-delà de 10 km). */
export function formatDistanceMeters(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  const decimals = km < 10 ? 1 : 0;
  return `${km.toFixed(decimals).replace('.', ',')} km`;
}
