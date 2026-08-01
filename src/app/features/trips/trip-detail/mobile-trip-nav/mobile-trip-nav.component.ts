import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { TripTab } from '../trip-tab.model';
import { ActivityDispatchService } from '@app/core/services/activity-dispatch.service';
import { TripChromeService } from '@app/core/services/trip-chrome.service';

/** Icônes des 3 tabs Activités/Logistique/Listes (voir `TripDetailComponent.tabs`) — `TripTab` ne porte pas d'icône, propre à cette barre. */
const GENERAL_TAB_ICONS: Record<string, string> = {
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
 * - "Général" (activeId() correspond à Activités/Logistique/Listes) : la
 *   bande de jours se replie, le badge devient une icône compacte (retour),
 *   3 sous-items (Activités/Logistique/Listes, désormais des tabs de premier
 *   niveau — voir `TripDetailComponent.tabs`) apparaissent en cascade.
 *
 * Aucun état local isolé pour "quelle section est active" : tout dérive de
 * `activeId()` (piloté par `TripDetailComponent`, lui-même mis à jour par le
 * swipe du swiper ET par le tap sur cette barre) — un swipe entre Activités/
 * Logistique/Listes/Jour 1 fait donc évoluer cette barre sans câblage
 * supplémentaire.
 */
@Component({
  selector: 'app-mobile-trip-nav',
  standalone: true,
  imports: [],
  templateUrl: './mobile-trip-nav.component.html',
  styleUrl: './mobile-trip-nav.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileTripNavComponent {
  private readonly dispatchService = inject(ActivityDispatchService);
  private readonly chromeService = inject(TripChromeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly tabs = input<TripTab[]>([]);
  readonly activeId = input<string>('');
  readonly tabSelected = output<{ id: string; index: number }>();

  private readonly wrapperRef = viewChild<ElementRef<HTMLElement>>('wrapper');
  private readonly dayStripRef = viewChild<ElementRef<HTMLElement>>('dayStrip');

  protected readonly generalTabs = computed(() => this.tabs().filter(t => !t.dayNumber));
  protected readonly dayTabs = computed(() => this.tabs().filter(t => !!t.dayNumber));

  /** Vrai dès que le tab actif est l'un des 3 tabs Général (Activités/Logistique/Listes). */
  protected readonly expanded = computed(() => this.generalTabs().some(t => t.id === this.activeId()));

  /** Numéro séquentiel du jour actif dans le voyage (pas la date) — badge affiché en état "Jours". */
  protected readonly activeDayIndex = computed(() => this.dayTabs().findIndex(t => t.id === this.activeId()));
  protected readonly activeDayLabel = computed(() => `Jour ${this.activeDayIndex() + 1}`);

  /**
   * Dernier jour actif connu (mis à jour dès que `activeId()` est un jour) :
   * seul signal local ajouté par ce composant — ne duplique pas la source de
   * vérité de la section active (`expanded`, dérivé de `activeId()`), sert
   * uniquement à savoir vers quel jour revenir en retapant l'icône compacte
   * "Jour X" (interaction absente de l'UI précédente, il n'y avait rien vers
   * quoi "revenir").
   */
  private readonly lastDayId = signal<string | null>(null);

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

    // Intégration drag-and-drop (voir ActivityDispatchService) : UNIQUEMENT la
    // géométrie de repli (`registerNavBarElement`), jamais
    // `registerNavBarCloneSource` — sur mobile, le calendrier de dépose
    // apparaît directement, sans réplique/FLIP de cette barre (décidé avec
    // l'utilisateur, voir ROADMAP.md "UX / Interactions" ; le mécanisme de
    // repli lui-même tolère déjà nativement l'absence de source de clone).
    effect((onCleanup) => {
      const el = this.wrapperRef()?.nativeElement;
      if (!el) {
        this.chromeService.registerHeight('tabsNav', 0);
        return;
      }

      this.dispatchService.registerNavBarElement(el);

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

  /** Icône compacte "Jour X" en état "Général" : referme et revient au dernier jour actif (ou le premier jour du trip si aucun n'a encore été visité). */
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
}
