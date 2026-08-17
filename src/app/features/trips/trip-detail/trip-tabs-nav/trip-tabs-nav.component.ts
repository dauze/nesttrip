import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, effect, inject, input, output, viewChild } from '@angular/core';
import { TripTab } from '../trip-tab.model';
import { TripChromeService } from '@app/core/services/ui/trip-chrome.service';

@Component({
  selector: 'app-trip-tabs-nav',
  standalone: true,
  imports: [],
  templateUrl: './trip-tabs-nav.component.html',
  styleUrl: './trip-tabs-nav.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripTabsNavComponent {
  private readonly hostRef = inject(ElementRef<HTMLElement>);
  private readonly chromeService = inject(TripChromeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly tabs = input<TripTab[]>([]);
  readonly activeId = input<string>('');
  readonly tabSelected = output<{ id: string; index: number }>();

 private readonly tabsListRef = viewChild('tabsListRef', { read: ElementRef });

  constructor() {
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

    // Rejoint le groupe qui glisse au scroll (toolbar+header) uniquement en
    // mode 'split-hideable' (layout scindé mais viewport trop bas pour garder
    // le chrome en permanence, ex. mobile paysage) — voir TripChromeService.
    // En 'mobile' elle reste fixe en bas (jamais masquée, comportement
    // historique) ; en 'split-pinned' rien ne se masque de toute façon.
    effect((onCleanup) => {
      if (this.chromeService.mode() !== 'split-hideable') return;
      const unregister = this.chromeService.registerChromeElement(this.hostRef.nativeElement);
      onCleanup(unregister);
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