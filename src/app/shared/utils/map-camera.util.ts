import { haversineDistanceMeters } from './geo.util';

/**
 * Maths pures de caméra/géométrie extraites de `TripDayMapComponent` (aucune dépendance
 * Angular, testables sans TestBed) — `computeOverviewCamera`/`estimateZoomDrop` restent aussi
 * des méthodes publiques sur `TripDayMapComponent` (déléguant ici), réutilisées telles quelles
 * par `GeneralMapCinematicService`.
 */

export interface CameraPoint {
  latitude: number;
  longitude: number;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Ease-in-out CUBIC (pas quad) : ralentit plus franchement à l'approche de chaque point (et au
 * départ) qu'une simple parabole quad — voir ROADMAP.md "UX / Interactions", retour utilisateur
 * "il faut vraiment que ce soit ralenti entre l'approche des points".
 */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Enveloppe de dézoom, pilotée par `t` BRUT (pas easé) — parabole `4t(1-t)` : lisse (dérivée
 * nulle SEULEMENT au sommet, pas de palier plat), pente la plus raide pile au départ/à
 * l'arrivée. Historique : une tente linéaire (pic anguleux) puis une rampe+palier (impression
 * figée/carrée) ont chacune été essayées et retirées — voir ROADMAP.md.
 */
export function zoomEnvelope(t: number): number {
  return 4 * t * (1 - t);
}

/** cf. https://stackoverflow.com/a/13274361 — calcul déterministe du zoom Google Maps pour un bbox donné, sans passer par `fitBounds`. */
export function getBoundsZoomLevel(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number,
  mapWidth: number,
  mapHeight: number,
): number {
  const ZOOM_MAX = 21;
  const WORLD_DIM = 256;

  const latRad = (lat: number) => {
    const sin = Math.sin((lat * Math.PI) / 180);
    const radX2 = Math.log((1 + sin) / (1 - sin)) / 2;
    return Math.max(Math.min(radX2, Math.PI), -Math.PI) / 2;
  };

  const zoomForFraction = (mapPx: number, fraction: number) =>
    Math.log(mapPx / WORLD_DIM / fraction) / Math.LN2;

  const latFraction = (latRad(maxLat) - latRad(minLat)) / Math.PI;
  const lngDiff = maxLng - minLng;
  const lngFraction = (lngDiff < 0 ? lngDiff + 360 : lngDiff) / 360;

  const latZoom = zoomForFraction(mapHeight, latFraction);
  const lngZoom = zoomForFraction(mapWidth, lngFraction);

  return Math.max(1, Math.min(latZoom, lngZoom, ZOOM_MAX));
}

/**
 * Centre + zoom calculés pour que tous les `points` tiennent dans un conteneur de
 * `viewportPx` (± une marge), sans dépendre de `map.fitBounds` (asynchrone) — voir
 * `TripDayMapComponent.computeOverviewCamera`, seul appelant (direct + via
 * `GeneralMapCinematicService`).
 */
export function computeOverviewCamera(
  points: CameraPoint[],
  viewportPx: { width: number; height: number },
  focusZoom: number,
): { center: google.maps.LatLngLiteral; zoom: number } | null {
  if (!points.length) return null;
  if (points.length === 1) {
    return { center: { lat: points[0].latitude, lng: points[0].longitude }, zoom: focusZoom };
  }

  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const p of points) {
    minLat = Math.min(minLat, p.latitude);
    maxLat = Math.max(maxLat, p.latitude);
    minLng = Math.min(minLng, p.longitude);
    maxLng = Math.max(maxLng, p.longitude);
  }

  const center = { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };

  // Marge pour ne pas coller les marqueurs extrêmes aux bords de la carte — généreuse car un pin
  // dépasse largement au-dessus de son point ancré (la pointe touche le point, la tête ronde
  // avec le numéro est ~40-50px plus haut), pas juste un point ponctuel.
  const PADDING_PX = 64;
  const width = Math.max(1, viewportPx.width - PADDING_PX * 2);
  const height = Math.max(1, viewportPx.height - PADDING_PX * 2);

  // Petit dézoom de sécurité en plus de la marge ci-dessus : la formule bbox->zoom ne connaît
  // que les coordonnées géographiques des points, pas la taille réelle des pins à l'écran
  // (numéro inclus) — sans cette marge les pins des points extrêmes débordent légèrement du
  // cadre visible.
  const OVERVIEW_ZOOM_BUFFER = 0.4;

  // Ne jamais dézoomer plus que nécessaire : si les points sont proches, pas d'intérêt à zoomer
  // plus serré que le zoom de focus habituel.
  const zoom = Math.max(
    1,
    Math.min(getBoundsZoomLevel(minLat, maxLat, minLng, maxLng, width, height) - OVERVIEW_ZOOM_BUFFER, focusZoom),
  );

  return { center, zoom };
}

/**
 * Amplitude du dézoom cinématique entre 2 points : zoom RÉEL nécessaire pour que les 2 points
 * tiennent dans le cadre (même formule bbox->zoom que `computeOverviewCamera`, même marge),
 * plafonnée à `MAX_ZOOM_DROP` — voir `TripDayMapComponent.estimateZoomDrop`, seul appelant
 * (direct + via `GeneralMapCinematicService`).
 */
export function estimateZoomDrop(
  from: CameraPoint,
  to: CameraPoint,
  viewportPx: { width: number; height: number },
  focusZoom: number,
): number {
  const distanceMeters = haversineDistanceMeters(from.latitude, from.longitude, to.latitude, to.longitude);
  if (distanceMeters < 50) return 0;

  const PADDING_PX = 64;
  const width = Math.max(1, viewportPx.width - PADDING_PX * 2);
  const height = Math.max(1, viewportPx.height - PADDING_PX * 2);
  const OVERVIEW_ZOOM_BUFFER = 0.4;
  const MAX_ZOOM_DROP = 6;

  const minLat = Math.min(from.latitude, to.latitude);
  const maxLat = Math.max(from.latitude, to.latitude);
  const minLng = Math.min(from.longitude, to.longitude);
  const maxLng = Math.max(from.longitude, to.longitude);

  const idealZoom = getBoundsZoomLevel(minLat, maxLat, minLng, maxLng, width, height) - OVERVIEW_ZOOM_BUFFER;
  return Math.min(MAX_ZOOM_DROP, Math.max(0, focusZoom - idealZoom));
}

/** Zoom cinématique le long d'un segment `from` -> `to` à la position `t` (brut, voir `zoomEnvelope`) — voir `TripDayMapComponent.followScroll`. */
export function computeCinematicZoom(
  from: CameraPoint,
  to: CameraPoint,
  t: number,
  viewportPx: { width: number; height: number },
  focusZoom: number,
): number {
  const zoomDrop = estimateZoomDrop(from, to, viewportPx, focusZoom);
  return focusZoom - zoomDrop * zoomEnvelope(t);
}
