import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { ButtonComponent } from '@app/shared/components/button/button.component';
import { TripTab } from '../../trip-tab.model';

interface MonthGroup {
  label: string;
  tabs: TripTab[];
}

// Mêmes valeurs que `ActivityDayDispatchOverlayComponent` (calendrier du
// drag-and-drop, voir ROADMAP.md "UX / Interactions") : même montée/descente
// CSS 0 -> 50vh depuis le bas de l'écran, demandée explicitement par
// l'utilisateur pour ce déclencheur "double-clic sur Jour N" — seule la
// mécanique de bulle qui suit le doigt (propre à un VRAI geste de drag) n'est
// pas reprise ici, voir la doc de ROADMAP.md pour le détail de la décision.
const EXPAND_DURATION_BASE_MS = 300;
const EXPAND_DURATION_PX_FACTOR_MS = 0.7;
const EXPAND_DURATION_MIN_MS = 300;
const EXPAND_DURATION_MAX_MS = 650;
/** Doit rester synchronisé avec `max-height: 50vh` sur `.day-picker-sheet--expanded .day-picker-sheet__sheet` (scss). */
const EXPANDED_HEIGHT_VH_RATIO = 0.5;

/**
 * Calendrier "jours du voyage" affiché en sheet montant depuis le bas de
 * l'écran — déclenché par un double-clic sur le badge "Jour N" de
 * `MobileTripNavComponent` (voir ROADMAP.md "UX / Interactions"). Reprend
 * fidèlement l'animation/le markup du calendrier de
 * `ActivityDayDispatchOverlayComponent` (drag-and-drop d'activité), MAIS sans
 * aucune de sa mécanique de drag (bulle qui suit le doigt, escalade/
 * désescalade, auto-scroll de bord, comptage d'activités par jour) : ici un
 * simple clic sur un jour sélectionne directement, pas de geste en cours.
 */
@Component({
  selector: 'app-day-picker-sheet',
  standalone: true,
  imports: [ButtonComponent],
  templateUrl: './day-picker-sheet.component.html',
  styleUrl: './day-picker-sheet.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DayPickerSheetComponent {
  readonly tabs = input<TripTab[]>([]);
  readonly daySelected = output<Date>();

  protected readonly isVisible = signal(false);
  protected readonly sheetExpanded = signal(false);
  /** Durée (ms) de la montée/descente — calculée à l'ouverture à partir de la distance réelle parcourue (0 -> 50vh), voir `open()`. */
  protected readonly expandDurationMs = signal(700);

  protected readonly monthGroups = computed<MonthGroup[]>(() => this.groupByMonth(this.tabs()));

  private closeTimer?: ReturnType<typeof setTimeout>;

  /** Ouvre le calendrier (no-op si déjà ouvert) — voir `MobileTripNavComponent.openDayCalendar`. */
  open(): void {
    if (this.isVisible()) return;

    const expandedHeightPx = window.innerHeight * EXPANDED_HEIGHT_VH_RATIO;
    const duration = EXPAND_DURATION_BASE_MS + expandedHeightPx * EXPAND_DURATION_PX_FACTOR_MS;
    this.expandDurationMs.set(
      Math.round(Math.min(EXPAND_DURATION_MAX_MS, Math.max(EXPAND_DURATION_MIN_MS, duration))),
    );

    this.isVisible.set(true);

    // Double rAF : sans ce délai, le navigateur peut fusionner "apparition à
    // hauteur 0" et "croissance" dans le même recalcul de style, et la
    // transition CSS ne se joue pas — même correctif que `ActivityDayDispatchOverlayComponent.openSheet`.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!this.isVisible()) return;
        this.sheetExpanded.set(true);
      });
    });
  }

  /** Ferme le calendrier avec la même transition CSS (symétrique de l'ouverture). */
  close(): void {
    if (!this.isVisible()) return;
    clearTimeout(this.closeTimer);
    this.sheetExpanded.set(false);
    this.closeTimer = setTimeout(() => this.isVisible.set(false), this.expandDurationMs());
  }

  /** Ferme uniquement sur un clic/Entrée sur le fond lui-même — un clic sur le sheet/un jour (bubblé jusqu'ici) ne doit pas fermer. */
  protected onBackdropClick(event: Event): void {
    if (event.target !== event.currentTarget) return;
    this.close();
  }

  protected onDayClick(tab: TripTab): void {
    this.daySelected.emit(new Date(tab.id));
    this.close();
  }

  private groupByMonth(tabs: TripTab[]): MonthGroup[] {
    const groups = new Map<string, TripTab[]>();
    for (const tab of tabs) {
      const year = new Date(tab.id).getFullYear();
      const label = capitalize(`${tab.monthFull ?? tab.month ?? ''} ${year}`.trim());
      groups.set(label, [...(groups.get(label) ?? []), tab]);
    }
    return [...groups.entries()].map(([label, groupTabs]) => ({ label, tabs: groupTabs }));
  }
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
