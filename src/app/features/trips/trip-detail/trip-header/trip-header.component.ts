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
import {
  TravelTiersDialogComponent,
  TravelTiersDialogData,
} from './travel-tiers-dialog/travel-tiers-dialog.component';
import { DEFAULT_TRAVEL_TIERS, TravelTiers } from '@app/features/trips/trip.model';

const MODE_LABEL: Record<TravelTiers['tier1Mode'], string> = { walk: 'Marche', bike: 'Vélo', car: 'Voiture' };
/** Icônes seules dans le libellé lecture seule (voir `travelTiersAriaLabel` pour l'équivalent texte, lu par les lecteurs d'écran) — `nt-icon-*` maison pour marche/vélo (aucun glyphe PrimeIcons adéquat, voir icons.scss), `pi-car` pour voiture. */
const MODE_ICON: Record<TravelTiers['tier1Mode'], string> = { walk: 'nt-icon-walk', bike: 'nt-icon-bike', car: 'pi pi-car' };

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
  readonly travelTiers = input<TravelTiers>(DEFAULT_TRAVEL_TIERS);

  readonly titleChange = output<string>();
  readonly datesChange = output<[Date, Date]>();
  readonly travelTiersChange = output<TravelTiers>();

  /** Paliers courants, lus par le template pour composer le libellé icônes+km (voir `modeIcon`/`fmtKm`). */
  protected readonly tiers = computed(() => this.travelTiers());

  protected modeIcon(mode: TravelTiers['tier1Mode']): string {
    return MODE_ICON[mode];
  }

  protected fmtKm(km: number): string {
    return Number.isInteger(km) ? String(km) : km.toString().replace('.', ',');
  }

  /** Équivalent texte du libellé icônes-seules (lecteurs d'écran) — ordre "mode, sinon" pour le palier 3, cohérent avec l'affichage. */
  protected readonly travelTiersAriaLabel = computed(() => {
    const tiers = this.travelTiers();
    return `Trajets : ${MODE_LABEL[tiers.tier1Mode]} ≤ ${this.fmtKm(tiers.tier1MaxKm)} km, ${MODE_LABEL[tiers.tier2Mode]} ≤ ${this.fmtKm(tiers.tier2MaxKm)} km, ${MODE_LABEL[tiers.tier3Mode]} sinon`;
  });

  private readonly datePickerRef = viewChild(DatePickerComponent);

  readonly dateForm = this.fb.group({
    dates: this.fb.control<Date[] | null>(null),
  });

  /**
   * Libellé "Date : " affiché en lecture seule à côté du crayon — voir
   * `openDatePicker`.
   *
   * Dérivé de `dateRange()` (signal d'entrée), PAS de `this.dateForm.value`
   * (régression 2026-08-05, ROADMAP.md "Bugs / fixes" : "la date n'est pas
   * changée après la sélection") : `FormGroup.value` est un getter ordinaire,
   * pas un signal — un `computed()` qui le lit ne suit AUCUNE dépendance
   * traçable et se fige donc définitivement après sa toute première
   * évaluation, qu'il s'agisse d'une sélection utilisateur (qui patch le
   * form) ou d'un changement distant (`patchFromRange`, plus bas). `dateRange`
   * est la source de vérité que `patchFromRange` recopie déjà DANS le form ;
   * la lire directement ici la rend réellement réactive, y compris pour ma
   * propre sélection (le cheminement `onDatesSelected` → `datesChange` →
   * `TripFacade.addDay`/`removeDay` → `_tripDays`/`_days` est synchrone :
   * `dateRange()` reflète la nouvelle plage sans latence perceptible).
   */
  readonly dateRangeLabel = computed(() => {
    const range = this.dateRange();
    if (!range) return '';
    const [start, end] = range;
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

  /** Paliers de trajet en lecture seule + crayon dédié — voir ROADMAP.md "Activités"/"UX / Interactions". */
  protected openTravelTiersDialog(): void {
    const dialogRef = this.dialogService.open<TravelTiers | undefined, TravelTiersDialogData>(
      TravelTiersDialogComponent,
      {
        data: { initialValue: this.travelTiers() },
        panelClass: 'app-wide-dialog-panel',
        viewContainerRef: this.viewContainerRef,
      },
    );

    dialogRef.closed.subscribe((result) => {
      if (result === undefined) return;
      this.travelTiersChange.emit(result);
    });
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
