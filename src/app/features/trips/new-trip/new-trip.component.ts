import { ChangeDetectionStrategy, Component, DestroyRef, ViewContainerRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { InputTextDirective } from '@app/shared/directives/input-text.directive';
import { DatePickerComponent } from '@app/shared/components/date-picker/date-picker.component';
import { ButtonComponent } from '@app/shared/components/button/button.component';
import { CardComponent } from '@app/shared/components/card/card.component';
import { Trip, Day } from '../trip.model';
import { Notes } from '../trip-detail/trip-day-swiper/general-panel/notes/notes.model';
import { AuthService } from '@app/core/services/auth.service';
import { GooglePlaceService } from '@app/core/services/google-place.service';
import { AutoCompleteComponent } from '@app/shared/components/autocomplete/autocomplete.component';
import { PlaceSummary } from '@app/core/models/place.dto';
import { TripFacade } from '../trip-facade.service';
import { ViewportService } from '@app/core/services/viewport.service';
import { DialogService } from '@app/shared/services/dialog.service';
import {
  TitleEditDialogComponent,
  TitleEditDialogData,
  TitleEditDialogResult,
} from '@app/shared/components/activity-card/activity-header/title-edit-dialog/title-edit-dialog.component';
import {
  SimpleTextEntryDialogComponent,
  SimpleTextEntryDialogData,
} from '@app/shared/components/simple-text-entry-dialog/simple-text-entry-dialog.component';

@Component({
  selector: 'app-new-trip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, InputTextDirective, DatePickerComponent, ButtonComponent,
    CardComponent, AutoCompleteComponent
  ],
  templateUrl: 'new-trip.component.html',
  styleUrl: 'new-trip.component.scss',
})
export class NewTripComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly tripFacade = inject(TripFacade);
  private readonly authService = inject(AuthService);
  private readonly googlePlaceService = inject(GooglePlaceService);
  protected readonly viewport = inject(ViewportService);
  private readonly dialogService = inject(DialogService);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly destroyRef = inject(DestroyRef);

  private readonly rawPlaces = this.googlePlaceService.places;

  private readonly autocompleteRef = viewChild(AutoCompleteComponent);
  private readonly datePickerRef = viewChild(DatePickerComponent);

  readonly form = this.fb.group({
    title: ['', Validators.required],
    ville: ['', Validators.required],
    placeId: [''],
    dates: this.fb.control<Date[] | null>(null, Validators.required),
  });

  readonly loading = signal(false);
  readonly searching = this.googlePlaceService.searching;

  private titleManuallyEdited = false;

  constructor() {
    this.form.controls.ville.valueChanges.subscribe((ville) => {
      if (this.titleManuallyEdited) return;
      const suggestion = ville ? `Road trip ${ville}` : '';
      this.form.controls.title.setValue(suggestion, { emitEvent: false });
    });

    this.form.controls.title.valueChanges.subscribe(() => {
      if (!this.titleManuallyEdited) this.titleManuallyEdited = true;
    });

    // Mobile : même comportement que la cinématique guidée des activités
    // (voir ROADMAP.md "UX / Interactions") — chaînage Ville → Nom → Dates à
    // l'arrivée sur l'écran, la saisie google s'ouvrant d'elle-même. Desktop :
    // formulaire déjà entièrement visible, seul le focus initial change (voir
    // `autocompleteRef`).
    afterNextRender(() => {
      if (this.viewport.isMobile()) {
        this.startGuidedEntry();
      } else {
        this.autocompleteRef()?.focus();
      }
    });
  }

  /** Ville → Nom → Dates, chacune ouvrant son tiroir dédié (voir openVilleDialog/openNomDialog) — auto-soumission dès que la plage de dates est complète, jamais bloquant si une étape est annulée en cours de route. */
  protected async startGuidedEntry(): Promise<void> {
    const villeResult = await this.openVilleDialog();
    if (!villeResult) return;
    this.applyVilleResult(villeResult);

    const title = await this.openNomDialog();
    if (title === undefined) return;
    this.form.controls.title.setValue(title);
    this.titleManuallyEdited = true;

    const datePicker = this.datePickerRef();
    if (!datePicker) return;
    datePicker.openPanel();
    const range = await this.awaitOnce(datePicker.selected);
    if (!Array.isArray(range)) return;
    this.form.controls.dates.setValue(range);
    this.onSubmit();
  }

  /** Retap du déclencheur mobile Ville (hors chaînage initial, voir template) — réédition ponctuelle. */
  protected async onVilleTriggerClick(): Promise<void> {
    const result = await this.openVilleDialog();
    if (result) this.applyVilleResult(result);
  }

  /** Retap du déclencheur mobile Nom (hors chaînage initial, voir template) — réédition ponctuelle. */
  protected async onNomTriggerClick(): Promise<void> {
    const text = await this.openNomDialog();
    if (text !== undefined) this.applyNomResult(text);
  }

  /**
   * Tiroir mobile "Ville / Pays" (voir ROADMAP.md "UX / Interactions") :
   * même composant que le titre d'activité (recherche Google OU texte
   * libre), réutilisé tel quel pour rester cohérent avec le reste de l'app.
   */
  private openVilleDialog(): Promise<TitleEditDialogResult | undefined> {
    this.form.controls.ville.markAsTouched();
    const dialogRef = this.dialogService.open<TitleEditDialogResult | undefined, TitleEditDialogData>(
      TitleEditDialogComponent,
      {
        data: { initialTitle: this.form.value.ville ?? '', title: 'Ville / Pays', placeholder: 'Rechercher une ville...' },
        panelClass: 'app-wide-dialog-panel',
        viewContainerRef: this.viewContainerRef,
        autoFocus: '.title-edit-dialog__input',
      },
    );
    return this.awaitOnce(dialogRef.closed);
  }

  /** Tiroir mobile "Nom du voyage" — champ texte simple (pas de recherche Google, voir ROADMAP.md). */
  private openNomDialog(): Promise<string | undefined> {
    this.form.controls.title.markAsTouched();
    const dialogRef = this.dialogService.open<string | undefined, SimpleTextEntryDialogData>(
      SimpleTextEntryDialogComponent,
      {
        data: { initialValue: this.form.value.title ?? '', title: 'Nom du voyage', placeholder: 'Ex : Road trip Islande' },
        panelClass: 'app-wide-dialog-panel',
        viewContainerRef: this.viewContainerRef,
        // Sans ça, l'autofocus CDK par défaut ('first-tabbable') cible le
        // bouton de fermeture (1er élément focusable du template), pas le
        // champ — même correctif que TitleEditDialogComponent (retour
        // utilisateur, 2026-08-02).
        autoFocus: '.simple-text-entry-dialog__input',
      },
    );
    return this.awaitOnce(dialogRef.closed);
  }

  /** Réédition ponctuelle du champ Ville (retap du déclencheur mobile, hors chaînage initial) — voir template. */
  protected applyVilleResult(result: TitleEditDialogResult): void {
    if (result.type === 'place') {
      this.onSelect(result.place);
      return;
    }
    this.form.controls.ville.setValue(result.text);
  }

  /** Réédition ponctuelle du champ Nom (retap du déclencheur mobile, hors chaînage initial) — voir template. */
  protected applyNomResult(text: string): void {
    this.form.controls.title.setValue(text);
    this.titleManuallyEdited = true;
  }

  /** Adapte un `output()`/une `Observable` (CDK `DialogRef.closed`) en `Promise` pour le chaînage `async`/`await` ci-dessus — même pattern que `LogisticDetailsComponent.awaitOnce`. */
  private awaitOnce<T>(source: { subscribe(next: (value: T) => void): { unsubscribe(): void } }): Promise<T> {
    return new Promise((resolve) => {
      const subscription = source.subscribe((value) => {
        subscription.unsubscribe();
        resolve(value);
      });
      this.destroyRef.onDestroy(() => subscription.unsubscribe());
    });
  }

  readonly placesWithPhotos = computed(() => {
    const list = this.rawPlaces();
    if (!list) return [];
      return list;
  });

  onSelect(place: PlaceSummary): void {
    this.form.patchValue({
      ville: place.name,
      placeId: place.placeId,
    });
  }

  onSearch(query: string): void {
    this.googlePlaceService.setSearchTerm(query ?? '');
  }

  protected displayPlaceName(place: PlaceSummary): string {
    return place.name;
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);

    const user = this.authService.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const [dateDebut, dateFin] = this.form.value.dates || [];

    const trip: Trip = {
      id: crypto.randomUUID(),
      title: this.form.value.title ?? '',
      ville: this.form.value.ville ?? '',
      placeId: this.form.value.placeId ?? '',
      days: this.buildDays(dateDebut, dateFin),
      activities: [],
      dayActivityInstances: [],
      logistics: [],
      notes: this.buildNote(),
      ownerId: user.uid,
      members: {
        [user.uid]: { role: 'owner', email: user.email ?? '', displayName: user.displayName ?? undefined },
      },
    };

    this.saveTrip(trip);
  }

  private buildDays(start: Date, end: Date): Day[] {
    const days: Day[] = [];
    const current = new Date(start);
    current.setHours(0, 0, 0, 0);
    const endNorm = new Date(end);
    endNorm.setHours(0, 0, 0, 0);
    while (current <= endNorm) {
      days.push({ id: new Date(current), activityIds: [] });
      current.setDate(current.getDate() + 1);
    }
    return days;
  }

  private buildNote(): Notes {
    return { id: crypto.randomUUID(), items: [] };
  }

  private saveTrip(trip: Trip): void {
    this.tripFacade.saveTrip(trip);
    this.router.navigate([`/trips/${trip.id}`]);
  }

  onCancel(): void {
    this.router.navigate(['/trips']);
  }
}