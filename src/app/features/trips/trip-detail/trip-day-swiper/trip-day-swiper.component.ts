import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  effect,
  input,
  output,
  signal,
  viewChild,
  inject,
  AfterViewInit,
  OnDestroy,
  Injector,
  afterNextRender,
} from '@angular/core';
import { Trip } from '../../trip.model';
import { DayPanelComponent } from './day-panel/day-panel.component';
import { GeneralPanelComponent } from './general-panel/general-panel.component';
import type { SwiperContainer } from 'swiper/element';
import { TripTab } from '../trip-tab.model';
import { SwiperLockService } from '@app/core/services/swiper-lock.service';
import { TripDayMapComponent } from './day-panel/trip-day-map/trip-day-map.component';
import { TripDayMapHostService } from '@app/core/services/trip-day-map-host.service';
import { TripChromeService } from '@app/core/services/trip-chrome.service';

@Component({
  selector: 'app-trip-day-swiper',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [DayPanelComponent, GeneralPanelComponent, TripDayMapComponent],
  providers: [SwiperLockService, TripDayMapHostService],
  templateUrl: './trip-day-swiper.component.html',
  styleUrl: './trip-day-swiper.component.scss',
})
export class TripDaySwiperComponent implements AfterViewInit, OnDestroy {
  private readonly lockService = inject(SwiperLockService);
  private readonly injector = inject(Injector);
  private readonly mapHost = inject(TripDayMapHostService);
  protected readonly chromeService = inject(TripChromeService);
  private readonly dayMapRef = viewChild(TripDayMapComponent);

  readonly trip = input.required<Trip>();
  readonly tabs = input<TripTab[]>([]);
  readonly activeId = input<string>('');
  readonly activeIdChange = output<string>();
  readonly ready = output<void>();

  readonly sortedDays = signal<Trip['days']>([]);
  readonly visitedDays = signal<Set<string>>(new Set());

  private readonly swiperRef = viewChild<ElementRef<SwiperContainer>>('swiperRef');
  private readonly viewReady = signal(false);
  private hasPositioned = false;
  private hasEmittedReady = false;

  // --- Flou dynamique pendant le swipe (défilement de gauche à droite ou inverse) ---
  // Un slide est net tant qu'il est visible à plus de 20% dans le viewport ;
  // en dessous de 20% de visibilité (qu'il soit en train d'arriver ou de
  // partir), le flou augmente de façon linéaire jusqu'au maximum quand il est
  // totalement hors champ.
  private static readonly BLUR_VISIBLE_THRESHOLD = 0.4;
  private static readonly MAX_BLUR_PX = 5;
  private blurLoopScheduled = false;
  private isDragging = false;
  private isTransitioning = false;
  private slideEls: HTMLElement[] = [];

  constructor() {
    // L'instance unique de la carte est créée une seule fois avec ce
    // composant. On l'enregistre dans le service dès qu'elle est disponible :
    // elle ne sera plus jamais recréée pour toute la durée de vie du trip.
    effect(() => {
      const map = this.dayMapRef();
      if (map) this.mapHost.register(map);
    });

    effect(() => {
      const days = this.trip().days.slice().sort((a, b) => a.id.getTime() - b.id.getTime());
      this.sortedDays.set(days);
    });

    effect(() => {
      if (!this.viewReady()) return;

      const id = this.activeId();
      const tabs = this.tabs();
      const index = tabs.findIndex(t => t.id === id);
      if (index < 0) return;

      this.preloadAround(index);

      // preloadAround() vient d'écrire dans visitedDays : le DOM du slide
      // ciblé n'est pas encore inséré (le @if ne sera flush qu'à la prochaine
      // passe de change detection). Si on appelle slideTo() maintenant,
      // Swiper cible un slide encore vide (aucun scrollTop à restaurer, aucun
      // contenu). On attend un flush DOM garanti avant de bouger le swiper.
      afterNextRender(() => {
        const swiperInstance = this.swiperRef()?.nativeElement?.swiper;
        if (!swiperInstance) return;

        const isFirstSync = !this.hasPositioned;
        this.hasPositioned = true;
        swiperInstance.allowTouchMove = !this.lockService.isLocked();
        if (swiperInstance.activeIndex !== index) {
          swiperInstance.slideTo(index, isFirstSync ? 0 : undefined);
        }

        // Le slide actif vient d'être (re)positionné : son scrollTop propre
        // (0 si jamais visité, conservé nativement par le DOM sinon) devient
        // la référence du chrome — resync instantanée, sans transition (voir
        // TripChromeService).
        this.syncChromeFromActiveSlide(swiperInstance);

        // Le slide actif est bien monté ET positionné : on attend encore
        // deux frames pour laisser le contenu enfant (images, map) se
        // stabiliser avant de prévenir le parent.
        if (isFirstSync && !this.hasEmittedReady) {
          this.waitForStableLayout();
        }
      }, { injector: this.injector });
    });
  }

  ngAfterViewInit(): void {
    const swiperEl = this.swiperRef()?.nativeElement;
    if (swiperEl) this.setupSwiper(swiperEl);
  }

  ngOnDestroy(): void {
    this.isDragging = false;
    this.isTransitioning = false;
    this.swiperRef()?.nativeElement?.removeEventListener('scroll', this.onSlideScroll, { capture: true });
  }

  private waitForStableLayout(): void {
    // 1er afterNextRender : le DOM du slide vient d'être inséré par le @if,
    // mais le contenu enfant (images, carte) peut avoir encore un recalcul en attente.
    afterNextRender(() => {
      afterNextRender(() => {
        if (this.hasEmittedReady) return;
        this.hasEmittedReady = true;
        this.ready.emit();
      }, { injector: this.injector });
    }, { injector: this.injector });
  }

  protected dayFor(id: string) {
    return this.sortedDays().find(d => d.id.toISOString() === id);
  }

  private setupSwiper(swiperEl: SwiperContainer): void {
    Object.assign(swiperEl, {
      speed: 360,
      observer: true,
      observeParents: true,
      observeSlideChildren: true,
      resistanceRatio: 0.85,
      spaceBetween: 8,
      longSwipesRatio: 0.45,
      longSwipesMs: 250,
      cssMode: false,
      injectStyles: [`
        .swiper {
            overflow: clip;
          }
        .swiper-wrapper {
          transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1) !important;
        }
      `]
    });

    swiperEl.initialize();

    // Un seul listener, posé une fois pour toute la durée de vie du swiper
    // (jamais réattaché à chaque changement de slide) : phase de capture pour
    // intercepter le scroll interne de N'IMPORTE QUEL slide, filtré par
    // égalité avec le slide actif courant. Alimente le chrome (toolbar +
    // header voyage, voir TripChromeService) au fil du scroll.
    swiperEl.addEventListener('scroll', this.onSlideScroll, { capture: true, passive: true });

    swiperEl.addEventListener('swiperslidechangetransitionstart', () => {
      const newIndex = swiperEl.swiper?.activeIndex;
      if (newIndex == null) return;
      const tab = this.tabs()[newIndex];
      if (!tab) return;
      this.preloadAround(newIndex);
      this.activeIdChange.emit(tab.id);
      this.syncChromeFromActiveSlide(swiperEl.swiper);
    });

    // Flou dynamique : on démarre le suivi dès que le doigt touche l'écran
    // (le déplacement en direct pendant le drag n'a pas de transition CSS),
    // et on le maintient pendant l'animation de fin de swipe (relâchement du
    // doigt ou navigation programmatique via un clic sur un onglet).
    swiperEl.addEventListener('swipertouchstart', () => {
      this.isDragging = true;
      this.captureSlideEls(swiperEl);
      this.scheduleBlurLoop(swiperEl);
    });
    swiperEl.addEventListener('swipertouchend', () => {
      this.isDragging = false;
    });
    swiperEl.addEventListener('swipertransitionstart', () => {
      this.isTransitioning = true;
      this.captureSlideEls(swiperEl);
      this.scheduleBlurLoop(swiperEl);
    });
    swiperEl.addEventListener('swipertransitionend', () => {
      this.isTransitioning = false;
    });

    this.viewReady.set(true);
  }

  /** Lit le scrollTop propre du slide actif et l'envoie au chrome (voir TripChromeService) — resync instantanée, sans transition. */
  private syncChromeFromActiveSlide(swiper: SwiperContainer['swiper']): void {
    const activeSlide = swiper?.slides?.[swiper.activeIndex] as HTMLElement | undefined;
    if (!activeSlide) return;
    this.chromeService.setScrollTop(activeSlide.scrollTop);
  }

  /**
   * Unique listener de scroll, posé une fois sur le conteneur du swiper (voir
   * `setupSwiper`) : capture les évènements `scroll` de N'IMPORTE QUEL slide
   * (le scroll interne d'un `swiper-slide` ne bulle pas mais est bien vu en
   * phase de capture par un ancêtre), filtrés par égalité avec le slide actif.
   */
  private readonly onSlideScroll = (event: Event): void => {
    const swiper = this.swiperRef()?.nativeElement?.swiper;
    const activeSlide = swiper?.slides?.[swiper.activeIndex] as HTMLElement | undefined;
    if (!activeSlide || event.target !== activeSlide) return;
    this.chromeService.setScrollTop(activeSlide.scrollTop);
  };

  private preloadAround(index: number): void {
    const tabs = this.tabs();
    const indices = [index - 1, index, index + 1].filter(i => i >= 0 && i < tabs.length);
    this.visitedDays.update(set => {
      const next = new Set(set);
      for (const i of indices) next.add(tabs[i].id);
      return next;
    });
  }

  private captureSlideEls(swiperEl: SwiperContainer): void {
    this.slideEls = Array.from(swiperEl.querySelectorAll('swiper-slide'));
  }

  private scheduleBlurLoop(swiperEl: SwiperContainer): void {
    if (this.blurLoopScheduled) return;
    this.blurLoopScheduled = true;

    const step = () => {
      this.updateSlidesBlur(swiperEl);
      if (this.isDragging || this.isTransitioning) {
        requestAnimationFrame(step);
      } else {
        this.blurLoopScheduled = false;
        this.resetSlidesBlur();
      }
    };
    requestAnimationFrame(step);
  }

  private updateSlidesBlur(swiperEl: SwiperContainer): void {
    if (this.slideEls.length === 0) return;
    const containerRect = swiperEl.getBoundingClientRect();

    for (const slideEl of this.slideEls) {
      const rect = slideEl.getBoundingClientRect();
      if (rect.width === 0) continue;

      const visibleWidth = Math.max(
        0,
        Math.min(rect.right, containerRect.right) - Math.max(rect.left, containerRect.left),
      );
      const visibleFraction = visibleWidth / rect.width;

      // Net (0) tant que visible à >= 20%. En dessous, le flou augmente
      // linéairement jusqu'au maximum quand la visibilité tend vers 0%.
      const blurFactor = Math.min(
        1,
        Math.max(0, TripDaySwiperComponent.BLUR_VISIBLE_THRESHOLD - visibleFraction) /
          TripDaySwiperComponent.BLUR_VISIBLE_THRESHOLD,
      );
      const blurPx = TripDaySwiperComponent.MAX_BLUR_PX * blurFactor;
      slideEl.style.setProperty('--slide-blur', `${blurPx.toFixed(2)}px`);
    }
  }

  private resetSlidesBlur(): void {
    for (const slideEl of this.slideEls) {
      slideEl.style.setProperty('--slide-blur', '0px');
    }
  }
}