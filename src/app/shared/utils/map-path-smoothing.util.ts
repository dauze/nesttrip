/**
 * Lissage de polyligne par spline Catmull-Rom (ROADMAP.md "UX / Interactions",
 * décision du 2026-10-30 : "des lignes droites ça fait trop carré").
 *
 * La carte (vue Jour et vue Résumé, même composant `TripDayMapComponent`)
 * reliait les activités d'un jour par des segments droits. `geodesic: true`
 * n'arrondit visiblement que les très longues distances (échelle
 * continentale) ; à l'échelle d'une ville, le rendu restait anguleux. On
 * densifie donc le `path` lui-même avec une courbe qui PASSE EXACTEMENT par
 * chaque point d'origine (propriété d'interpolation de Catmull-Rom), en
 * insérant des points intermédiaires entre chaque paire consécutive.
 *
 * lat/lng sont traités comme un plan cartésien local : à l'échelle d'un jour
 * de voyage (quelques km à quelques dizaines de km) la distorsion de la
 * projection est négligeable pour un simple tracé décoratif, et Google Maps
 * relie de toute façon les points rapprochés de la spline par des segments
 * (quasi-)droits à l'écran.
 */

export type LatLng = google.maps.LatLngLiteral;

/** Nombre de sous-segments générés entre deux points consécutifs. Plus haut = plus lisse, mais plus de points à dessiner. 12 suffit visuellement sans alourdir la polyline. */
const SEGMENTS_PER_SPAN = 12;

/** Tension Catmull-Rom standard (spline uniforme). 0.5 correspond à la forme "centripète" douce la plus courante ; conservé implicite dans la formule ci-dessous. */

/**
 * Retourne une version lissée du chemin : la courbe passe par tous les points
 * d'entrée, avec des points intermédiaires interpolés entre chacun.
 *
 * - 0, 1 ou 2 points : rien à lisser (un segment unique est déjà "droit" par
 *   nature, aucune angulosité à corriger), le chemin est renvoyé tel quel.
 * - Les extrémités sont dupliquées comme points de contrôle fantômes pour que
 *   la courbe démarre/termine exactement sur le premier/dernier point.
 */
export function smoothPath(points: readonly LatLng[]): LatLng[] {
  if (points.length <= 2) {
    return points.map((point) => ({ lat: point.lat, lng: point.lng }));
  }

  const result: LatLng[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    // Chaque span [p1, p2] génère SEGMENTS_PER_SPAN sous-points (t de 0 inclus
    // à 1 exclu) ; le point final (t=1) est ajouté une seule fois à la toute
    // fin pour ne pas dupliquer les sommets partagés entre spans successifs.
    for (let step = 0; step < SEGMENTS_PER_SPAN; step++) {
      result.push(spanPoint(points, i, step / SEGMENTS_PER_SPAN));
    }
  }

  const last = points[points.length - 1];
  result.push({ lat: last.lat, lng: last.lng });

  return result;
}

/**
 * Portion de la courbe de `smoothPath` parcourue jusqu'à `progress`, exprimé
 * en index d'activité fractionnaire (0 = 1er point, 1.5 = mi-chemin entre le
 * 2e et le 3e…). Mêmes sous-points que `smoothPath`, plus le point exact de tête.
 */
export function smoothPathUntil(points: readonly LatLng[], progress: number): LatLng[] {
  if (points.length <= 1) {
    return points.map((point) => ({ lat: point.lat, lng: point.lng }));
  }

  const clamped = Math.min(points.length - 1, Math.max(0, progress));
  const lastSpan = Math.min(Math.floor(clamped), points.length - 2);
  const localT = clamped - lastSpan;
  const result: LatLng[] = [];

  for (let i = 0; i <= lastSpan; i++) {
    const end = i < lastSpan ? 1 : localT;
    for (let step = 0; step < SEGMENTS_PER_SPAN && step / SEGMENTS_PER_SPAN < end; step++) {
      result.push(spanPoint(points, i, step / SEGMENTS_PER_SPAN));
    }
  }

  const end = points[lastSpan + 1];
  result.push(localT === 1 ? { lat: end.lat, lng: end.lng } : spanPoint(points, lastSpan, localT));
  return result;
}

/** Point à `t` ∈ [0,1] du span [points[i], points[i+1]], extrémités dupliquées comme points de contrôle fantômes. */
function spanPoint(points: readonly LatLng[], i: number, t: number): LatLng {
  const p0 = points[i - 1] ?? points[i];
  const p1 = points[i];
  const p2 = points[i + 1];
  const p3 = points[i + 2] ?? points[i + 1];
  return {
    lat: catmullRom(p0.lat, p1.lat, p2.lat, p3.lat, t),
    lng: catmullRom(p0.lng, p1.lng, p2.lng, p3.lng, t),
  };
}

/** Interpolation Catmull-Rom uniforme sur un axe scalaire pour t ∈ [0,1] entre v1 et v2 (v0/v3 = points de contrôle encadrants). */
function catmullRom(v0: number, v1: number, v2: number, v3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    ((2 * v1) +
      (-v0 + v2) * t +
      (2 * v0 - 5 * v1 + 4 * v2 - v3) * t2 +
      (-v0 + 3 * v1 - 3 * v2 + v3) * t3)
  );
}
