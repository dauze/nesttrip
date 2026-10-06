/** Borne `value` entre `min` et `max`. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Conteneur de scroll isolé le plus proche. En mobile, chaque jour est un
 * `swiper-slide` (son propre scrollport). En desktop, le Swiper n'est plus
 * monté (voir TripDetailComponent / l'option B de la refonte desktop) : la
 * vue Jour est rendue dans un scrollport unique marqué `[data-scrollport]`
 * (voir TripDetailDesktopComponent) — on y retombe quand aucun `swiper-slide`
 * n'est présent. Tous les consommateurs (DayScrollSyncService,
 * DayReorderService, FabBottomProximityDirective, LogisticsListComponent)
 * passent par ici, donc fonctionnent sans changement dans les deux mondes.
 */
export function getScrollContainer(el: HTMLElement): HTMLElement | null {
  return el.closest('swiper-slide') ?? el.closest<HTMLElement>('[data-scrollport]');
}

/**
 * Anime le scroll d'un conteneur vers `targetY`, avec un ease-out cubique.
 * Retourne une fonction d'annulation (utile si l'appelant est détruit en cours d'animation).
 */
export function smoothScrollTo(container: HTMLElement, targetY: number, duration = 600): () => void {
  let cancelled = false;
  const startY = container.scrollTop;
  const distance = targetY - startY;
  const startTime = performance.now();
  const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

  const animate = (currentTime: number) => {
    if (cancelled) return;
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    container.scrollTop = startY + distance * easeOutCubic(progress);
    if (progress < 1) requestAnimationFrame(animate);
  };

  requestAnimationFrame(animate);
  return () => { cancelled = true; };
}
