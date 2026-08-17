import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { ButtonComponent } from '@app/shared/components/actions/button/button.component';
import { TripTab } from '../../trip-tab.model';
import { DayMonthGroup, computeExpandDurationMs, groupByMonth } from '@app/shared/utils/day-grid-sheet.util';

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

  protected readonly monthGroups = computed<DayMonthGroup<TripTab>[]>(() => groupByMonth(this.tabs(), (tab) => new Date(tab.id)));

  private closeTimer?: ReturnType<typeof setTimeout>;

  /** Ouvre le calendrier (no-op si déjà ouvert) — voir `MobileTripNavComponent.openDayCalendar`. */
  open(): void {
    if (this.isVisible()) return;

    this.expandDurationMs.set(computeExpandDurationMs(window.innerHeight));

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
}
