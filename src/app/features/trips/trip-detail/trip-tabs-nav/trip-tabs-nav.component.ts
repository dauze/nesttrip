import { Component, DestroyRef, ElementRef, afterNextRender, inject, input, output, viewChild } from '@angular/core';
import { TabsModule } from 'primeng/tabs';
import { TripTab } from '../trip-tab.model';
import { ActivityDispatchService } from '@app/core/services/activity-dispatch.service';
import { TripChromeService } from '@app/core/services/trip-chrome.service';

@Component({
  selector: 'app-trip-tabs-nav',
  standalone: true,
  imports: [TabsModule],
  templateUrl: './trip-tabs-nav.component.html',
  styleUrl: './trip-tabs-nav.component.scss',
})
export class TripTabsNavComponent {
  private readonly hostRef = inject(ElementRef<HTMLElement>);
  private readonly dispatchService = inject(ActivityDispatchService);
  private readonly chromeService = inject(TripChromeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly tabs = input<TripTab[]>([]);
  readonly activeId = input<string>('');
  readonly tabSelected = output<{ id: string; index: number }>();

 private readonly tabsListRef = viewChild('tabsListRef', { read: ElementRef });

  constructor() {
    // Sert de point de départ géométrique à l'animation d'ouverture du
    // calendrier de dépose (voir ActivityDayDispatchOverlayComponent).
    afterNextRender(() => this.dispatchService.registerNavBarElement(this.hostRef.nativeElement));

    // Hauteur réservée en padding-bottom par le contenu des slides (voir
    // TripChromeService/trip-day-swiper) pour que la dernière activité ne
    // reste jamais masquée sous cette barre, jamais déplacée ni masquée elle-même.
    afterNextRender(() => {
      // getBoundingClientRect (pas entry.contentRect, qui exclut le padding/bordure)
      // pour mesurer le vrai encombrement visuel de la barre.
      const observer = new ResizeObserver(() => {
        this.chromeService.registerHeight('tabsNav', this.hostRef.nativeElement.getBoundingClientRect().height);
      });
      observer.observe(this.hostRef.nativeElement);
      this.destroyRef.onDestroy(() => {
        observer.disconnect();
        this.chromeService.registerHeight('tabsNav', 0);
      });
    });
  }

  protected onTabClick(id: string, index: number): void {
    this.tabSelected.emit({ id, index });
  }

  /** Appelée explicitement par le parent (clic sur tab ET swipe) */
  scrollIntoView(index: number): void {
    requestAnimationFrame(() => {
      const tabs = this.tabsListRef()?.nativeElement.querySelectorAll('[role="tab"]');
      const el = tabs?.[index] as HTMLElement | undefined;
      el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    });
  }
}