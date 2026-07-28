import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, effect, inject, input, viewChild } from '@angular/core';
import { SelectButtonComponent } from '@app/shared/components/select-button/select-button.component';
import { TripChromeService } from '@core/services/trip-chrome.service';
import { ViewportService } from '@core/services/viewport.service';
import { GeneralCreationSubTab, TripCreationTargetService } from '../trip-creation-target.service';

/**
 * Bascule Activités/Réservations/Notes flottante en bas d'écran, mobile
 * uniquement (voir ROADMAP.md) — doublon MOBILE de la bascule inline en haut
 * de `GeneralPanelComponent` (masquée en dessous de 768px, voir son SCSS),
 * pour rester visible/accessible en permanence pendant le scroll sans avoir
 * à remonter en haut de la liste. Vrai `position: fixed`, donc monté HORS du
 * swiper de jours par `TripDetailComponent`, exactement comme
 * `FloatingAddButtonComponent` (même raison : `swiper-slide` applique un
 * transform permanent qui casserait un `position:fixed` posé à l'intérieur)
 * — d'où le passage par `TripCreationTargetService` pour lire/piloter le
 * sous-onglet actif de `GeneralPanelComponent` sans lien direct dans l'arbre
 * de vues.
 */
@Component({
  selector: 'app-general-sub-tab-bar',
  standalone: true,
  imports: [SelectButtonComponent],
  templateUrl: './general-sub-tab-bar.component.html',
  styleUrl: './general-sub-tab-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.--sub-tab-bar-bottom-offset.px]': 'bottomOffset()',
  },
})
export class GeneralSubTabBarComponent {
  protected readonly fabTarget = inject(TripCreationTargetService);
  protected readonly viewport = inject(ViewportService);
  private readonly chromeService = inject(TripChromeService);
  private readonly destroyRef = inject(DestroyRef);

  /** Espace à réserver sous la barre (hauteur de la barre des jours, `TripChromeService.tabsNavHeight()`) — même pattern que `FloatingAddButtonComponent.bottomOffset`. */
  readonly bottomOffset = input(0);

  /** `:host` est `display:contents` (voir le SCSS) : pas de box propre à mesurer, donc on observe ce wrapper interne, seulement présent dans le DOM quand affiché (mobile + onglet Général monté). */
  private readonly barRef = viewChild<ElementRef<HTMLElement>>('bar');

  constructor() {
    // effect() (pas un ResizeObserver posé une seule fois en constructeur) :
    // `.sub-tab-bar` va et vient dans le DOM au fil du @if (viewport mobile,
    // onglet Général monté ou non) — se rebranche à chaque apparition,
    // republie 0 à chaque disparition (voir onCleanup) pour que
    // GeneralPanelComponent libère aussitôt la place réservée.
    effect((onCleanup) => {
      const el = this.barRef()?.nativeElement;
      if (!el) {
        this.chromeService.registerHeight('generalSubTabBar', 0);
        return;
      }

      const observer = new ResizeObserver(() => {
        this.chromeService.registerHeight('generalSubTabBar', el.getBoundingClientRect().height);
      });
      observer.observe(el);
      onCleanup(() => observer.disconnect());
    });

    this.destroyRef.onDestroy(() => this.chromeService.registerHeight('generalSubTabBar', 0));
  }

  protected selectSubTab(tab: GeneralCreationSubTab | undefined): void {
    if (tab) this.fabTarget.general()?.selectSubTab(tab);
  }
}
