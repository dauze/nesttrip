import { Directive, DestroyRef, ElementRef, afterNextRender, inject, model, output } from '@angular/core';
import { getScrollContainer } from '@app/shared/utils/scroll-container';

/** Distance de tirage (px) pour atteindre 100% (`pullProgress` = 1, seuil de déclenchement). */
const PULL_DISTANCE_PX = 70;
/** Rubber-band au-delà du seuil : `pullProgress` continue de croître mais de plus en plus lentement, jusqu'à ce plafond (jamais un tirage "infini" qui suivrait le doigt à l'identique). */
const PULL_MAX_PROGRESS = 1.4;
/** Sous ce déplacement (px), la direction du geste (vertical vs horizontal, tirage vs scroll) n'est pas encore tranchée — même principe que `LongPressDirective`/`ActivityCardComponent`. */
const DIRECTION_LOCK_PX = 8;

/**
 * Geste "tirer pour actualiser" façon Google (Gmail/Chrome mobile, voir
 * ROADMAP.md) — posé sur le CONTENEUR DE SCROLL DE PAGE (`.app-content`,
 * TripsComponent), jamais globalement sur `document` : ne s'engage QUE si
 * (1) le pointeur démarre HORS de tout `swiper-slide` (voir `getScrollContainer`)
 * — trip-detail gère son propre scroll par jour via Swiper, dont le geste
 * tactile ne doit JAMAIS être intercepté par celui-ci (retour utilisateur
 * explicite, "attention au interception de slidev") — et (2) le conteneur
 * est déjà tout en haut (`scrollTop === 0`) au moment du `pointerdown`.
 *
 * Verrouillage de direction (`DIRECTION_LOCK_PX`) avant tout `preventDefault()` :
 * tant que le mouvement reste sous ce seuil, ce n'est ni un tirage ni un
 * scroll confirmé — dès qu'il est dépassé, SOIT le mouvement est
 * majoritairement vertical vers le BAS (on prend la main, `preventDefault()`
 * empêche le rebond natif du navigateur pour laisser notre propre animation
 * prendre le relais), SOIT non (on relâche définitivement pour ce geste,
 * laissant le scroll/swipe natif faire son travail sans jamais l'avoir
 * perturbé).
 *
 * Ce composant ne gère QUE le geste + la physique (`pullProgress`,
 * `refreshing`) : l'indicateur visuel est un composant à part
 * (`PullToRefreshIndicatorComponent`, présentationnel), affiché par
 * l'appelant — pas de manipulation DOM ici en dehors des listeners.
 */
@Directive({
  selector: '[appPullToRefresh]',
  standalone: true,
})
export class PullToRefreshDirective {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  /** 0 (repos) à `PULL_MAX_PROGRESS` — deux-voies : l'appelant peut aussi la remettre à 0 lui-même si besoin (jamais nécessaire en usage normal, la directive s'en charge). */
  readonly pullProgress = model(0);
  /** Deux-voies : passe à `true` par la directive quand le seuil est franchi au relâchement ; l'APPELANT la repasse à `false` une fois son "actualisation" terminée (ici purement visuelle, voir TripsComponent — Firestore streame déjà en temps réel, rien à re-fetcher). */
  readonly refreshing = model(false);
  /** Émis UNE FOIS par geste validé, au moment exact où `refreshing` passe à `true` — point d'accroche pour l'appelant (ex. rejouer une micro-animation, éventuel futur vrai refetch). */
  readonly refresh = output<void>();

  private pointerId: number | null = null;
  private startX = 0;
  private startY = 0;
  /** `null` tant que la direction n'est pas tranchée ; `true`/`false` une fois verrouillée pour tout le reste du geste. */
  private pulling: boolean | null = null;

  constructor() {
    afterNextRender(() => {
      const el = this.elementRef.nativeElement;
      el.addEventListener('pointerdown', this.onPointerDown);
      document.addEventListener('pointermove', this.onPointerMove, { passive: false });
      document.addEventListener('pointerup', this.onPointerUp);
      document.addEventListener('pointercancel', this.onPointerUp);

      this.destroyRef.onDestroy(() => {
        el.removeEventListener('pointerdown', this.onPointerDown);
        document.removeEventListener('pointermove', this.onPointerMove);
        document.removeEventListener('pointerup', this.onPointerUp);
        document.removeEventListener('pointercancel', this.onPointerUp);
      });
    });
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (this.refreshing()) return;
    // Jamais à l'intérieur d'un jour (Swiper) : voir la doc de classe.
    if (getScrollContainer(event.target as HTMLElement)) return;
    if (window.scrollY > 0 || this.elementRef.nativeElement.scrollTop > 0) return;

    this.pointerId = event.pointerId;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.pulling = null;
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) return;

    const dx = event.clientX - this.startX;
    const dy = event.clientY - this.startY;

    if (this.pulling === null) {
      if (Math.abs(dx) < DIRECTION_LOCK_PX && Math.abs(dy) < DIRECTION_LOCK_PX) return;
      // Vertical dominant ET vers le bas uniquement — un tirage vers le haut
      // (ou une diagonale à dominante horizontale) relâche définitivement le
      // pointeur pour ce geste, sans jamais avoir appelé `preventDefault()`.
      this.pulling = dy > 0 && Math.abs(dy) > Math.abs(dx);
      if (!this.pulling) {
        this.pointerId = null;
        return;
      }
    }

    if (!this.pulling) return;

    // On tient désormais le geste : plus aucun risque d'avoir perturbé un
    // scroll/swipe natif entamé ailleurs (verrouillage déjà tranché ci-dessus).
    event.preventDefault();

    const pulledPx = Math.max(0, dy);
    const raw = pulledPx / PULL_DISTANCE_PX;
    // Rubber-band au-delà de 1 : ralentit progressivement plutôt que de
    // suivre le doigt à l'identique jusqu'à l'infini (racine carrée,
    // atténuation classique de ce type de geste).
    const eased = raw <= 1 ? raw : 1 + Math.sqrt(raw - 1) * 0.4;
    this.pullProgress.set(Math.min(PULL_MAX_PROGRESS, eased));
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) return;
    this.pointerId = null;

    const wasPulling = this.pulling === true;
    this.pulling = null;
    if (!wasPulling) return;

    if (this.pullProgress() >= 1) {
      this.pullProgress.set(1);
      this.refreshing.set(true);
      this.refresh.emit();
    } else {
      this.pullProgress.set(0);
    }
  };
}
