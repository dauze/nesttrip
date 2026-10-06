import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, effect, inject, input, output, signal, viewChild } from '@angular/core';
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

  /**
   * Débordement horizontal de la barre des jours (desktop) : la scrollbar
   * native est masquée (voir SCSS) au profit de fondus latéraux + chevrons
   * discrets. `canScrollLeft`/`canScrollRight` pilotent l'affichage de ces
   * repères — on ne les montre que du côté où il reste réellement des jours à
   * défiler. Mesurés sur `.app-tabs__list` (le vrai conteneur scrollable) via
   * un listener de scroll + un ResizeObserver (changement de nombre de jours
   * ou de largeur de fenêtre).
   */
  protected readonly canScrollLeft = signal(false);
  protected readonly canScrollRight = signal(false);

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

    // Suivi du débordement horizontal (desktop) : recalcule
    // `canScrollLeft`/`canScrollRight` à chaque scroll de la barre et à chaque
    // changement de taille (nombre de jours, largeur de fenêtre). Alimente les
    // fondus + chevrons (voir le template/SCSS).
    afterNextRender(() => {
      const list = this.scrollListEl();
      if (!list) return;

      list.addEventListener('scroll', this.updateScrollShadows, { passive: true });
      const resizeObserver = new ResizeObserver(() => this.updateScrollShadows());
      resizeObserver.observe(list);
      this.updateScrollShadows();

      this.destroyRef.onDestroy(() => {
        list.removeEventListener('scroll', this.updateScrollShadows);
        resizeObserver.disconnect();
      });
    });
  }

  /** Le vrai conteneur scrollable horizontalement (`.app-tabs__list`, enfant de `#tabsListRef`). */
  private scrollListEl(): HTMLElement | null {
    return this.tabsListRef()?.nativeElement.querySelector('.app-tabs__list') ?? null;
  }

  private readonly updateScrollShadows = (): void => {
    const list = this.scrollListEl();
    if (!list) return;
    const max = list.scrollWidth - list.clientWidth;
    // Marge de 1px : évite un chevron qui clignote sur un écart sub-pixel
    // (scrollWidth/clientWidth arrondis différemment selon le zoom navigateur).
    this.canScrollLeft.set(list.scrollLeft > 1);
    this.canScrollRight.set(list.scrollLeft < max - 1);
  };

  /** Clic sur un chevron : défile d'environ 80% de la largeur visible (une "page" de jours). */
  protected scrollByPage(direction: -1 | 1): void {
    const list = this.scrollListEl();
    if (!list) return;
    list.scrollBy({ left: direction * list.clientWidth * 0.8, behavior: 'smooth' });
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