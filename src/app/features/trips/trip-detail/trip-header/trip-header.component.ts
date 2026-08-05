import { ChangeDetectionStrategy, Component, ViewContainerRef, computed, effect, inject, input, output, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { format } from 'date-fns';
import { CardComponent } from '@app/shared/components/card/card.component';
import { DatePickerComponent } from '@app/shared/components/date-picker/date-picker.component';
import { DialogService } from '@app/shared/services/dialog.service';
import {
  SimpleTextEntryDialogComponent,
  SimpleTextEntryDialogData,
} from '@app/shared/components/simple-text-entry-dialog/simple-text-entry-dialog.component';

@Component({
  selector: 'app-trip-header',
  standalone: true,
  imports: [ReactiveFormsModule, CardComponent, DatePickerComponent],
  templateUrl: './trip-header.component.html',
  styleUrl: './trip-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripHeaderComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogService = inject(DialogService);
  private readonly viewContainerRef = inject(ViewContainerRef);

  /** Signal dédié (voir `TripFacade.getTripDateRange`/`TripStore._tripDays`), pas `activeTrip()` — voir la doc du constructeur. */
  readonly dateRange = input<[Date, Date] | undefined>(undefined);
  readonly title = input<string>('');

  readonly titleChange = output<string>();
  readonly datesChange = output<[Date, Date]>();

  private readonly datePickerRef = viewChild(DatePickerComponent);

  readonly dateForm = this.fb.group({
    dates: this.fb.control<Date[] | null>(null),
  });

  /** Libellé "Date : " affiché en lecture seule à côté du crayon — voir `openDatePicker`. */
  readonly dateRangeLabel = computed(() => {
    const dates = this.dateForm.value.dates;
    const [start, end] = dates ?? [];
    if (!start || !end) return '';
    return `${format(start, 'dd/MM/yyyy')} - ${format(end, 'dd/MM/yyyy')}`;
  });

  constructor() {
    // Resynchronise le formulaire à CHAQUE changement réel de `dateRange`
    // (signal dédié — voir sa doc) : que ce changement vienne de ma propre
    // édition (répercutée en optimiste) ou d'un AUTRE collaborateur
    // (ROADMAP.md "Bugs / fixes", "un changement distant de l'intervalle de
    // dates n'était pas mis à jour en temps réel"). Contrairement à l'ancien
    // `trip` (recomposé par `activeTrip()`, qui variait aussi pour des
    // raisons totalement sans rapport ailleurs dans le trip — ROADMAP.md,
    // "toute la page se réactualise"), `dateRange` ne change QUE si les
    // jours du trip changent réellement : plus besoin de garde "une seule
    // fois par trip", `emitEvent:false` suffit à ne pas re-déclencher
    // `onDatesSelected` en boucle.
    effect(() => {
      const range = this.dateRange();
      if (!range) return;
      this.patchFromRange(range);
    });
  }

  /** Titre en lecture seule + crayon dédié (voir ROADMAP.md "UX / Interactions") — même popup texte simple que les titres Logistique. */
  protected openTitleDialog(): void {
    const dialogRef = this.dialogService.open<string | undefined, SimpleTextEntryDialogData>(
      SimpleTextEntryDialogComponent,
      {
        data: { initialValue: this.title(), placeholder: 'Titre du voyage', title: 'Titre' },
        panelClass: 'app-wide-dialog-panel',
        viewContainerRef: this.viewContainerRef,
        // Sans ça, l'autofocus CDK par défaut ('first-tabbable') cible le
        // bouton de fermeture, pas le champ (retour utilisateur, 2026-08-02).
        autoFocus: '.simple-text-entry-dialog__input',
      },
    );

    dialogRef.closed.subscribe((result) => {
      if (result === undefined) return;
      this.onTitleBlur(result);
    });
  }

  /** Dates en lecture seule + crayon dédié : ouvre le même calendrier qu'avant, juste plus caché derrière un déclencheur explicite. */
  protected openDatePicker(): void {
    this.datePickerRef()?.openPanel();
  }

  protected onTitleBlur(value: string): void {
    const trimmed = value.trim();
    if (!trimmed || trimmed === this.title()) return;
    this.titleChange.emit(trimmed);
  }

  protected onDatesSelected(): void {
    const dates = this.dateForm.value.dates;
    if (!dates || !dates[0] || !dates[1]) return;
    this.datesChange.emit([dates[0], dates[1]]);
  }

  /** Permet au parent de revenir à la plage d'origine si l'utilisateur annule une suppression. */
  resetDates(): void {
    const range = this.dateRange();
    if (!range) return;
    this.patchFromRange(range);
  }

  private patchFromRange([start, end]: [Date, Date]): void {
    this.dateForm.patchValue({ dates: [start, end] }, { emitEvent: false });
  }
}
