import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { TripTab } from '../trip-tab.model';
import { TripChromeService } from '@app/core/services/ui/trip-chrome.service';
import { DayPickerSheetComponent } from './day-picker-sheet/day-picker-sheet.component';
import { OnboardingAnchorDirective } from '@app/shared/directives/onboarding-anchor.directive';

/** Icônes des 4 tabs Résumé/Activités/Logistique/Listes (voir `TripDetailComponent.tabs`) — `TripTab` ne porte pas d'icône, propre à cette barre. */
const GENERAL_TAB_ICONS: Record<string, string> = {
  summary: 'pi pi-home',
  activities: 'pi pi-map-marker',
  logistics: 'pi pi-bookmark',
  notes: 'pi pi-clipboard',
};

/**
 * Barre de navigation bas d'écran mobile (portrait ET paysage tactile, voir
 * `ViewportService.isMobileChrome`) — remplace à la fois l'ancienne
 * `TripTabsNavComponent` (positionnée en bas) et l'ancienne
 * `GeneralSubTabBarComponent` (barre flottante séparée) par UNE seule barre
 * qui morphe entre deux états (voir ROADMAP.md "UX / Interactions") :
 *
 * - "Jours" (par défaut) : une bande de chips scrollable (tous les jours) au-
 *   dessus d'une barre à 2 items — badge "Jour N" (jour actif) + "Général".
 * - "Général" (activeId() correspond à Résumé/Activités/Logistique/Listes) :
 *   la bande de jours se replie, le badge devient une icône compacte (retour),
 *   4 sous-items (Résumé/Activités/Logistique/Listes, désormais des tabs de
 *   premier niveau — voir `TripDetailComponent.tabs`) apparaissent en cascade.
 *
 * Aucun état local isolé pour "quelle section est active" : tout dérive de
 * `activeId()` (piloté par `TripDetailComponent`, lui-même mis à jour par le
 * swipe du swiper ET par le tap sur cette barre) — un swipe entre Résumé/
 * Activités/Logistique/Listes/Jour 1 fait donc évoluer cette barre sans
 * câblage supplémentaire.
 */
@Component({
  selector: 'app-mobile-trip-nav',
  standalone: true,
  imports: [DayPickerSheetComponent, OnboardingAnchorDirective],
  templateUrl: './mobile-trip-nav.component.html',
  styleUrl: './mobile-trip-nav.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileTripNavComponent {
  private readonly chromeService = inject(TripChromeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly tabs = input<TripTab[]>([]);
  readonly activeId = input<string>('');
  readonly tabSelected = output<{ id: string; index: number }>();

  private readonly wrapperRef = viewChild<ElementRef<HTMLElement>>('wrapper');
  private readonly dayStripRef = viewChild<ElementRef<HTMLElement>>('dayStrip');
  private readonly dayCalendar = viewChild(DayPickerSheetComponent);

  protected readonly generalTabs = computed(() => this.tabs().filter(t => !t.dayNumber));
  protected readonly dayTabs = computed(() => this.tabs().filter(t => !!t.dayNumber));

  /** Vrai dès que le tab actif est l'un des 3 tabs Général (Activités/Logistique/Listes). */
  protected readonly expanded = computed(() => this.generalTabs().some(t => t.id === this.activeId()));

  /**
   * Dernier jour actif connu (mis à jour dès que `activeId()` est un jour) :
   * seul signal local ajouté par ce composant — ne duplique pas la source de
   * vérité de la section active (`expanded`, dérivé de `activeId()`), sert
   * uniquement à savoir vers quel jour revenir en retapant le bouton bascule
   * "Jour par jour" (interaction absente de l'UI précédente, il n'y avait rien
   * vers quoi "revenir").
   */
  private readonly lastDayId = signal<string | null>(null);

  /** Libellé statique du bouton bascule (ex badge dynamique "Jour N", renommé — voir ROADMAP.md) : le jour actif reste visible via le chip surligné de la bande de jours, pas besoin de le répéter ici. */
  protected readonly dayToggleLabel = 'Jour par jour';

  protected dayChipLabel(tab: TripTab): string {
    return `${tab.weekday} ${tab.dayNumber} ${tab.month}`;
  }

  protected generalTabIcon(tab: TripTab): string {
    return GENERAL_TAB_ICONS[tab.id] ?? 'pi pi-circle';
  }

  constructor() {
    effect(() => {
      const id = this.activeId();
      if (this.dayTabs().some(t => t.id === id)) this.lastDayId.set(id);
    });

    // Centre automatiquement le chip du jour actif dans la bande scrollable
    // (voir ROADMAP.md) — composant autonome, pas besoin que
    // `TripDetailComponent` le pilote (contrairement à `TripTabsNavComponent`,
    // dont les appels `scrollIntoView` explicites deviennent des no-op
    // silencieux ici via l'optional chaining déjà en place côté parent).
    effect(() => {
      const id = this.activeId();
      const stripEl = this.dayStripRef()?.nativeElement;
      if (!stripEl) return;
      requestAnimationFrame(() => {
        const chip = stripEl.querySelector<HTMLElement>(`[data-day-id="${id}"]`);
        chip?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      });
    });

    // Hauteur réelle de la barre (bande de jours + bar), tenue à jour par
    // ResizeObserver : sert entre autres au calendrier de dépose (voir
    // ActivityDayDispatchOverlayComponent.collapsedHeight) pour superposer sa
    // barre repliée à la vraie barre mobile, qui n'a pas de réplique/clone
    // ici — sur mobile, le calendrier de dépose apparaît directement, sans
    // réplique/FLIP de cette barre (décidé avec l'utilisateur, voir
    // ROADMAP.md "UX / Interactions").
    effect((onCleanup) => {
      const el = this.wrapperRef()?.nativeElement;
      if (!el) {
        this.chromeService.registerHeight('tabsNav', 0);
        return;
      }

      const observer = new ResizeObserver(() => {
        this.chromeService.registerHeight('tabsNav', el.getBoundingClientRect().height);
      });
      observer.observe(el);
      onCleanup(() => observer.disconnect());
    });

    this.destroyRef.onDestroy(() => this.chromeService.registerHeight('tabsNav', 0));
  }

  protected selectTab(tab: TripTab): void {
    const index = this.tabs().findIndex(t => t.id === tab.id);
    this.tabSelected.emit({ id: tab.id, index });
  }

  /** Bouton "Jour par jour" en état "Général" : referme et revient au dernier jour actif (ou le premier jour du trip si aucun n'a encore été visité). */
  protected goBackToDay(): void {
    if (!this.expanded()) return;
    const targetId = this.lastDayId() ?? this.dayTabs()[0]?.id;
    if (!targetId) return;
    const index = this.tabs().findIndex(t => t.id === targetId);
    this.tabSelected.emit({ id: targetId, index });
  }

  /** Bouton "Général" en état "Jours" : ouvre sur le premier tab (Activités). */
  protected openGeneral(): void {
    const first = this.generalTabs()[0];
    if (!first) return;
    this.selectTab(first);
  }

  /** Double-clic sur le badge "Jour N" : ouvre le calendrier des jours du voyage (voir ROADMAP.md "UX / Interactions"). */
  protected openDayCalendar(): void {
    this.dayCalendar()?.open();
  }

  /** Un jour hors voyage ne peut pas être sélectionné dans ce calendrier (grille limitée aux jours du trip) : la recherche ne peut donc pas échouer en usage normal. */
  protected onDaySelected(date: Date): void {
    const tab = this.dayTabs().find(t => new Date(t.id).toDateString() === date.toDateString());
    if (tab) this.selectTab(tab);
  }
}
