import { Directive, ElementRef, OnDestroy, OnInit, Renderer2, inject, input } from '@angular/core';
import {
  PULL_TO_REFRESH_DIRECTION_LOCK,
  PULL_TO_REFRESH_THRESHOLD,
  computePullDistance,
} from '@app/shared/utils/pull-to-refresh.util';

type Phase = 'idle' | 'pending' | 'confirmed' | 'aborted';

/**
 * "Tirer pour actualiser" maison — reproduit le geste natif du navigateur
 * (Chrome), cassé sur les slides Swiper (voir `TripDaySwiperComponent.setupSwiper`,
 * `threshold: 10` déjà posé côté Swiper pour la même raison, réutilisé ici
 * comme `PULL_TO_REFRESH_DIRECTION_LOCK`) : un seul `preventDefault()` sur un
 * `touchmove` désengage le rubber-band natif pour tout le reste du geste,
 * donc pas de mécanisme fiable pour ne l'activer QUE quand ce n'est pas un
 * swipe entre jours. Réimplémenté ici entièrement en JS, appliqué de façon
 * identique sur accueil-trip/new-trip (scroll de la page, voir
 * `appPullToRefreshTarget="window"`) et sur chaque `swiper-slide` de la vue
 * jour (scroll interne du slide, voir `TripChromeService`/`DayScrollSyncService`
 * pour le même conteneur).
 *
 * Duplique littéralement F5 (`window.location.reload()`) plutôt qu'un simple
 * refetch de données : l'utilisateur retombe sur le skeleton de chargement
 * initial de l'écran, exactement comme un vrai rechargement de page.
 *
 * Geste non simulable via Playwright (même limite que documentée pour le
 * pull-to-refresh natif, voir ROADMAP_already done.md) — à vérifier sur un
 * vrai device tactile.
 */
@Directive({
  selector: '[appPullToRefresh]',
  standalone: true,
})
export class PullToRefreshDirective implements OnInit, OnDestroy {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly renderer = inject(Renderer2);

  /** `'self'` (défaut) : l'hôte lui-même scrolle (ex. `swiper-slide`, `overflow-y: auto`). `'window'` : l'hôte est en flux normal, c'est `document.scrollingElement` qui scrolle (accueil-trip/new-trip). */
  readonly appPullToRefreshTarget = input<'self' | 'window'>('self');

  private indicatorEl!: HTMLElement;
  private iconEl!: HTMLElement;

  private phase: Phase = 'idle';
  private startX = 0;
  private startY = 0;
  private currentDistance = 0;
  private refreshing = false;

  ngOnInit(): void {
    const host = this.elementRef.nativeElement;

    if (getComputedStyle(host).position === 'static') {
      this.renderer.setStyle(host, 'position', 'relative');
    }

    this.indicatorEl = this.renderer.createElement('div');
    this.renderer.addClass(this.indicatorEl, 'nt-pull-to-refresh');
    this.renderer.setAttribute(this.indicatorEl, 'aria-hidden', 'true');

    this.iconEl = this.renderer.createElement('i');
    this.renderer.addClass(this.iconEl, 'pi');
    this.renderer.addClass(this.iconEl, 'pi-refresh');
    this.renderer.addClass(this.iconEl, 'nt-pull-to-refresh__icon');

    this.renderer.appendChild(this.indicatorEl, this.iconEl);
    this.renderer.appendChild(host, this.indicatorEl);

    host.addEventListener('touchstart', this.onTouchStart, { passive: true });
    host.addEventListener('touchmove', this.onTouchMove, { passive: false });
    host.addEventListener('touchend', this.onTouchEnd, { passive: true });
    host.addEventListener('touchcancel', this.onTouchEnd, { passive: true });
  }

  ngOnDestroy(): void {
    const host = this.elementRef.nativeElement;
    host.removeEventListener('touchstart', this.onTouchStart);
    host.removeEventListener('touchmove', this.onTouchMove);
    host.removeEventListener('touchend', this.onTouchEnd);
    host.removeEventListener('touchcancel', this.onTouchEnd);
    this.indicatorEl?.remove();
  }

  private getScrollTop(): number {
    if (this.appPullToRefreshTarget() === 'window') {
      return document.scrollingElement?.scrollTop ?? 0;
    }
    return this.elementRef.nativeElement.scrollTop;
  }

  private readonly onTouchStart = (event: TouchEvent): void => {
    if (this.refreshing) return;
    const touch = event.touches[0];
    if (!touch || this.getScrollTop() > 0) {
      this.phase = 'idle';
      return;
    }
    this.startX = touch.clientX;
    this.startY = touch.clientY;
    this.phase = 'pending';
  };

  private readonly onTouchMove = (event: TouchEvent): void => {
    if (this.refreshing || this.phase === 'idle' || this.phase === 'aborted') return;

    const touch = event.touches[0];
    if (!touch) return;

    const deltaX = touch.clientX - this.startX;
    const deltaY = touch.clientY - this.startY;

    if (this.phase === 'pending') {
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Dévie plus à l'horizontale qu'à la verticale : swipe entre jours,
        // on rend la main entièrement (plus jamais touché pour ce geste).
        this.phase = 'aborted';
        return;
      }
      if (deltaY <= 0 || deltaY < PULL_TO_REFRESH_DIRECTION_LOCK) {
        // Remonte, ou pas encore assez de recul pour trancher — on attend,
        // sans toucher à l'évènement (laisse Swiper/le scroll natif décider
        // en parallèle tant qu'on n'a pas nous-même confirmé le geste).
        return;
      }
      this.phase = 'confirmed';
    }

    if (this.getScrollTop() > 0) {
      // Le contenu a fini par scroller sous le doigt (ex. rebond) : ce n'est
      // plus un vrai pull-to-refresh, on abandonne proprement.
      this.phase = 'aborted';
      this.setDistance(0);
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.setDistance(computePullDistance(deltaY));
  };

  private readonly onTouchEnd = (): void => {
    if (this.phase === 'confirmed') {
      if (this.currentDistance >= PULL_TO_REFRESH_THRESHOLD) {
        this.triggerRefresh();
      } else {
        this.setDistance(0);
      }
    }
    this.phase = 'idle';
  };

  private setDistance(distance: number): void {
    this.currentDistance = distance;
    const progress = Math.min(1, distance / PULL_TO_REFRESH_THRESHOLD);
    this.renderer.setStyle(this.indicatorEl, 'transform', `translate(-50%, ${distance}px)`);
    this.renderer.setStyle(this.indicatorEl, 'opacity', String(progress));
    this.renderer.setStyle(this.iconEl, 'transform', `rotate(${progress * 180}deg)`);
  }

  private triggerRefresh(): void {
    this.refreshing = true;
    this.renderer.addClass(this.indicatorEl, 'nt-pull-to-refresh--spinning');
    this.setDistance(PULL_TO_REFRESH_THRESHOLD);
    // Petit délai purement visuel (le spinner a le temps de s'afficher) avant
    // le vrai rechargement — voir la doc de classe, ceci duplique F5.
    setTimeout(() => window.location.reload(), 300);
  }
}
