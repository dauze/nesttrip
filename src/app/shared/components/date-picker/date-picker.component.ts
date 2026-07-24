import { Component, ElementRef, TemplateRef, ViewContainerRef, computed, forwardRef, inject, input, output, signal, viewChild } from '@angular/core';
import { ConnectedPosition, Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { addDays, addMonths, addYears, eachDayOfInterval, format, isBefore, isSameDay, isSameMonth, isToday as isTodayDate, startOfMonth, startOfWeek, subMonths, subYears } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ViewportService } from '@core/services/viewport.service';

const WEEK_DAY_LABELS = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];

/** Sous le champ, aligné sur son bord gauche ; bascule au-dessus si la place manque en bas. */
const DESKTOP_POSITIONS: ConnectedPosition[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
];

/**
 * Remplacement maison de `p-datepicker` (Phase 7f de la sortie de PrimeNG,
 * voir PRIMENG_MIGRATION.md — dernière sous-phase de la Phase 7). Sur
 * `@angular/cdk/overlay`, comme `SelectComponent`/`AutoCompleteComponent`
 * (mêmes Phases 7d/7e) : même raison (top layer, voir la doc de
 * `TooltipDirective`). Calcul des dates (grille du mois, semaines) via
 * `date-fns`, seule nouvelle dépendance de toute la migration — décision
 * prise dès le départ (voir PRIMENG_MIGRATION.md, "Décisions retenues") :
 * une lib headless de calcul, tout le rendu/l'interaction restent maison.
 *
 * Desktop : panneau ancré sous le champ (`flexibleConnectedTo`), comme
 * `Select`/`AutoComplete`. Mobile (`ViewportService.isMobile()`) : centré à
 * l'écran avec fond flouté — reproduit le comportement `[touchUI]` de
 * l'ancien `p-datepicker` (voir l'historique de `styles.scss`), pas le
 * tiroir plein écran ancré en bas de `Select` (un calendrier a besoin de sa
 * hauteur naturelle, pas de s'étirer en bas d'écran).
 *
 * `[range]` bascule entre un `Date | null` (mode par défaut, ex: deadline de
 * réservation) et un `Date[] | null` à 2 éléments (dates de voyage) — même
 * forme `[dateDebut, dateFin]` que l'ancien `selectionMode="range"` de
 * PrimeNG, pour un portage 1:1 des appelants. Le clic sur un jour :
 * - mode simple : sélectionne et ferme immédiatement ;
 * - mode plage : 1er clic pose le début (rouvre une sélection si la plage
 *   précédente était déjà complète), 2e clic pose la fin (dans l'ordre
 *   chronologique, peu importe l'ordre des clics) et ferme — la valeur du
 *   form n'est mise à jour (`onChange`) qu'une fois la plage complète,
 *   jamais avec un seul bout, comme le faisait l'appelant historique
 *   (`onDatesSelected` ne lisait que `dates[0] && dates[1]`).
 *
 * `viewMode` (`'days' | 'months' | 'years'`) : le titre du panneau en vue
 * jours est scindé en 2 boutons indépendants ("juillet" / "2026"), chacun
 * menant à un niveau de zoom DIFFÉRENT plutôt qu'une chaîne unique
 * mois→année :
 * - cliquer sur le MOIS ouvre directement la grille des 12 mois de l'année
 *   en cours ; choisir un mois revient directement à la grille des jours
 *   (pas de détour par la grille des années) ;
 * - cliquer sur l'ANNÉE ouvre directement la grille de 12 années ; choisir
 *   une année enchaîne vers la grille des mois (pour ce nouveau
 *   millésime), qui revient elle-même à la grille des jours une fois un
 *   mois choisi.
 * Mêmes boutons précédent/suivant, dont la portée (mois, année ou bloc de
 * 12 ans) suit le niveau de zoom courant. Le titre de la vue mois (l'année
 * seule) reste cliquable vers la vue années, pour ceux qui zooment
 * progressivement plutôt que directement via le raccourci "année".
 * La grille des jours affiche TOUJOURS 6 semaines (42 jours), jamais 4 ou 5
 * selon le mois (piège identifié après coup : un mois de 28 jours tombant
 * pile sur des semaines complètes ne génère que 4 lignes avec un calcul
 * naïf `startOfWeek(monthStart)` → `endOfWeek(endOfMonth)`, ce qui fait
 * sauter la hauteur du panneau — donc claquer visuellement — en changeant
 * de mois) : la grille est toujours calculée comme 42 jours consécutifs
 * depuis `gridStart`, quel que soit le mois affiché.
 */
@Component({
  selector: 'app-date-picker',
  standalone: true,
  templateUrl: './date-picker.component.html',
  styleUrl: './date-picker.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DatePickerComponent),
      multi: true,
    },
  ],
})
export class DatePickerComponent implements ControlValueAccessor {
  private readonly overlay = inject(Overlay);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  protected readonly viewport = inject(ViewportService);

  readonly range = input(false);
  readonly placeholder = input('Sélectionner une date');
  readonly icon = input(true);
  readonly inputId = input('');

  /** Émis avec la valeur finale (Date en mode simple, [début, fin] en mode plage) quand une sélection se termine. */
  readonly selected = output<Date | [Date, Date]>();

  protected readonly weekDayLabels = WEEK_DAY_LABELS;

  private readonly singleValue = signal<Date | null>(null);
  private readonly rangeStart = signal<Date | null>(null);
  private readonly rangeEnd = signal<Date | null>(null);
  private readonly hoveredDay = signal<Date | null>(null);
  private readonly viewMonth = signal(startOfMonth(new Date()));

  protected readonly viewMode = signal<'days' | 'months' | 'years'>('days');
  private readonly yearsRangeStart = signal(Math.floor(new Date().getFullYear() / 12) * 12);
  protected readonly monthIndexes = Array.from({ length: 12 }, (_, i) => i);

  protected readonly isOpen = signal(false);
  protected readonly isDisabled = signal(false);

  private readonly panelTemplate = viewChild.required<TemplateRef<unknown>>('panel');

  /** Vue mois/années uniquement — la vue jours utilise `monthOnlyLabel`/`yearOnlyLabel` (2 boutons indépendants). */
  protected readonly headerTitle = computed(() => {
    if (this.viewMode() === 'months') return format(this.viewMonth(), 'yyyy');
    const start = this.yearsRangeStart();
    return `${start} - ${start + 11}`;
  });

  protected readonly monthOnlyLabel = computed(() => format(this.viewMonth(), 'MMMM', { locale: fr }));
  protected readonly yearOnlyLabel = computed(() => format(this.viewMonth(), 'yyyy'));

  protected readonly years = computed(() => {
    const start = this.yearsRangeStart();
    return Array.from({ length: 12 }, (_, i) => start + i);
  });

  /** Toujours 42 jours (6 semaines) quel que soit le mois affiché — voir la doc de la classe. */
  protected readonly weeks = computed(() => {
    const monthStart = startOfMonth(this.viewMonth());
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: gridStart, end: addDays(gridStart, 41) });

    const weeks: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
    return weeks;
  });

  protected readonly displayText = computed(() => {
    if (!this.range()) {
      const value = this.singleValue();
      return value ? format(value, 'dd/MM/yyyy') : '';
    }

    const start = this.rangeStart();
    const end = this.rangeEnd();
    if (!start) return '';
    if (!end) return `${format(start, 'dd/MM/yyyy')} - …`;
    return `${format(start, 'dd/MM/yyyy')} - ${format(end, 'dd/MM/yyyy')}`;
  });

  private overlayRef?: OverlayRef;
  private onChange?: (value: Date | Date[] | null) => void;
  private onTouched?: () => void;

  writeValue(value: Date | Date[] | null): void {
    if (this.range()) {
      const [start, end] = Array.isArray(value) ? value : [null, null];
      this.rangeStart.set(start ?? null);
      this.rangeEnd.set(end ?? null);
      return;
    }
    this.singleValue.set(Array.isArray(value) ? null : value ?? null);
  }

  registerOnChange(fn: (value: Date | Date[] | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
    if (isDisabled) this.close();
  }

  protected toggle(): void {
    if (this.isDisabled()) return;
    if (this.overlayRef) {
      this.close();
      return;
    }
    this.open();
  }

  protected prevPage(): void {
    const mode = this.viewMode();
    if (mode === 'days') this.viewMonth.update((month) => subMonths(month, 1));
    else if (mode === 'months') this.viewMonth.update((month) => subYears(month, 1));
    else this.yearsRangeStart.update((year) => year - 12);
  }

  protected nextPage(): void {
    const mode = this.viewMode();
    if (mode === 'days') this.viewMonth.update((month) => addMonths(month, 1));
    else if (mode === 'months') this.viewMonth.update((month) => addYears(month, 1));
    else this.yearsRangeStart.update((year) => year + 12);
  }

  /** Raccourci direct depuis la vue jours (clic sur le mois), ou zoom depuis la vue mois (titre = année). */
  protected showMonths(): void {
    this.viewMode.set('months');
  }

  /** Raccourci direct depuis la vue jours (clic sur l'année), ou zoom depuis la vue mois vers la vue années. */
  protected showYears(): void {
    this.yearsRangeStart.set(Math.floor(this.viewMonth().getFullYear() / 12) * 12);
    this.viewMode.set('years');
  }

  protected selectMonth(monthIndex: number): void {
    this.viewMonth.update((month) => new Date(month.getFullYear(), monthIndex, 1));
    this.viewMode.set('days');
  }

  protected selectYear(year: number): void {
    this.viewMonth.update((month) => new Date(year, month.getMonth(), 1));
    this.viewMode.set('months');
  }

  protected monthLabel(monthIndex: number): string {
    return format(new Date(2000, monthIndex, 1), 'MMM', { locale: fr });
  }

  protected isViewedMonth(monthIndex: number): boolean {
    return this.viewMonth().getMonth() === monthIndex;
  }

  protected isCurrentMonthIndex(monthIndex: number): boolean {
    const now = new Date();
    return now.getMonth() === monthIndex && now.getFullYear() === this.viewMonth().getFullYear();
  }

  protected isViewedYear(year: number): boolean {
    return this.viewMonth().getFullYear() === year;
  }

  protected isCurrentYear(year: number): boolean {
    return new Date().getFullYear() === year;
  }

  protected onDayHover(day: Date): void {
    this.hoveredDay.set(day);
  }

  protected onGridMouseLeave(): void {
    this.hoveredDay.set(null);
  }

  protected isCurrentMonth(day: Date): boolean {
    return isSameMonth(day, this.viewMonth());
  }

  protected isToday(day: Date): boolean {
    return isTodayDate(day);
  }

  protected isSelected(day: Date): boolean {
    if (this.range()) return false;
    const value = this.singleValue();
    return !!value && isSameDay(day, value);
  }

  protected isRangeStart(day: Date): boolean {
    const start = this.rangeStart();
    return !!start && isSameDay(day, start);
  }

  protected isRangeEnd(day: Date): boolean {
    const end = this.rangeEnd();
    if (end) return isSameDay(day, end);
    // Aperçu au survol tant que la plage n'est pas complète.
    const start = this.rangeStart();
    const hovered = this.hoveredDay();
    return !!start && !!hovered && isSameDay(day, hovered) && !isBefore(hovered, start);
  }

  protected isInRange(day: Date): boolean {
    const start = this.rangeStart();
    if (!start) return false;

    const end = this.rangeEnd() ?? (!isBefore(this.hoveredDay() ?? start, start) ? this.hoveredDay() : null);
    if (!end) return false;

    return isBefore(start, day) && isBefore(day, end);
  }

  protected selectDay(day: Date): void {
    if (!this.range()) {
      this.singleValue.set(day);
      this.onChange?.(day);
      this.selected.emit(day);
      this.close();
      return;
    }

    const start = this.rangeStart();
    const end = this.rangeEnd();

    if (!start || end) {
      this.rangeStart.set(day);
      this.rangeEnd.set(null);
      return;
    }

    const [rangeStart, rangeEnd] = isBefore(day, start) ? [day, start] : [start, day];
    this.rangeStart.set(rangeStart);
    this.rangeEnd.set(rangeEnd);
    this.onChange?.([rangeStart, rangeEnd]);
    this.selected.emit([rangeStart, rangeEnd]);
    this.close();
  }

  private open(): void {
    this.viewMonth.set(startOfMonth(this.rangeStart() ?? this.singleValue() ?? new Date()));
    this.viewMode.set('days');
    const isMobile = this.viewport.isMobile();

    const positionStrategy = isMobile
      ? this.overlay.position().global().centerHorizontally().centerVertically()
      : this.overlay
          .position()
          .flexibleConnectedTo(this.elementRef.nativeElement)
          .withPositions(DESKTOP_POSITIONS)
          .withFlexibleDimensions(false)
          .withPush(true);

    const overlayRef = this.overlay.create({
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      hasBackdrop: true,
      backdropClass: isMobile ? 'app-date-picker-backdrop--mobile' : 'cdk-overlay-transparent-backdrop',
      panelClass: isMobile ? 'app-date-picker-overlay--mobile' : 'app-date-picker-overlay--desktop',
    });
    this.overlayRef = overlayRef;

    overlayRef.backdropClick().subscribe(() => this.close());
    overlayRef.keydownEvents().subscribe((event) => {
      if (event.key === 'Escape') this.close();
    });

    overlayRef.attach(new TemplatePortal(this.panelTemplate(), this.viewContainerRef));
    this.isOpen.set(true);
  }

  private close(): void {
    if (!this.overlayRef) return;
    this.overlayRef.dispose();
    this.overlayRef = undefined;
    this.isOpen.set(false);
    this.hoveredDay.set(null);
    this.onTouched?.();
  }
}
