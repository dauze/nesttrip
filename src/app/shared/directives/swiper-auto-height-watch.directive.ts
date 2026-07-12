import { Directive, ElementRef, NgZone, OnDestroy, OnInit, inject } from '@angular/core';
import { SwiperHeightSyncService } from '@app/core/services/swiper-height-sync.service';

@Directive({
  selector: '[appSwiperAutoHeightWatch]',
  standalone: true,
})
export class SwiperAutoHeightWatchDirective implements OnInit, OnDestroy {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly heightSync = inject(SwiperHeightSyncService);
  private readonly zone = inject(NgZone);

  private observer?: ResizeObserver;
  private rafId?: number;
  private trackUntil = 0;

  // Durée max pendant laquelle on suit une animation détectée. À aligner
  // (ou dépasser légèrement) sur la durée réelle des animations PrimeNG
  // utilisées dans la hiérarchie (panel, accordion...).
  private static readonly TRACK_WINDOW_MS = 450;

  ngOnInit(): void {
    this.zone.runOutsideAngular(() => {
      this.observer = new ResizeObserver(() => this.onResize());
      this.observer.observe(this.el.nativeElement);
    });
  }

  private onResize(): void {
    // Chaque notification de resize prolonge la fenêtre de suivi plutôt
    // que d'annuler/relancer un seul rAF : on ne rate plus la fin d'une
    // animation qui déclenche plusieurs resizes successifs.
    this.trackUntil = performance.now() + SwiperAutoHeightWatchDirective.TRACK_WINDOW_MS;
    if (this.rafId == null) {
      this.rafId = requestAnimationFrame(this.trackLoop);
    }
  }

  private trackLoop = (now: number): void => {
    this.heightSync.update(0);
    if (now < this.trackUntil) {
      this.rafId = requestAnimationFrame(this.trackLoop);
    } else {
      this.rafId = undefined;
    }
  };

  ngOnDestroy(): void {
    this.observer?.disconnect();
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }
}