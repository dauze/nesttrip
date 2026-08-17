/** Formate une date en `YYYY-MM-DD` pour les query params du proxy vols maison (voir `FlightLookupApiService`/`FlightStatusApiService`). */
export function formatDateParam(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
