/**
 * Distance (px) au-delà de laquelle relâcher le doigt déclenche le refresh
 * (voir `PullToRefreshDirective`).
 */
export const PULL_TO_REFRESH_THRESHOLD = 64;

/** Distance visuelle max de l'indicateur, quelle que soit l'ampleur du geste. */
export const PULL_TO_REFRESH_MAX_DISTANCE = 96;

/**
 * Même seuil que `threshold: 10` de Swiper (voir `TripDaySwiperComponent.setupSwiper`) :
 * tant que le geste n'a pas parcouru cette distance verticale, on ne tranche
 * pas encore entre "tirer pour actualiser" et "swipe horizontal entre jours" —
 * évite de voler un swipe de jour dont les tout premiers pixels dévient
 * légèrement à la verticale (mouvement de doigt jamais parfaitement rectiligne).
 */
export const PULL_TO_REFRESH_DIRECTION_LOCK = 10;

/**
 * Distance visuelle de l'indicateur pour un déplacement brut `rawDeltaY`
 * donné — résistance façon rubber-band (asymptote vers `maxDistance`, jamais
 * dépassée) plutôt qu'un simple `Math.min`, pour un geste qui "ralentit"
 * progressivement comme le pull-to-refresh natif au lieu de se figer net à
 * la limite.
 */
export function computePullDistance(rawDeltaY: number, maxDistance = PULL_TO_REFRESH_MAX_DISTANCE): number {
  if (rawDeltaY <= 0) return 0;
  return maxDistance * (1 - Math.exp(-rawDeltaY / maxDistance));
}
