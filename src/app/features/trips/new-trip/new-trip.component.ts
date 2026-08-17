import { ChangeDetectionStrategy, Component, DestroyRef, ViewContainerRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { filter, take } from 'rxjs';
import { InputTextDirective } from '@app/shared/directives/input-text.directive';
import { DatePickerComponent } from '@app/shared/components/form-fields/date-picker/date-picker.component';
import { ButtonComponent } from '@app/shared/components/actions/button/button.component';
import { CardComponent } from '@app/shared/components/layout/card/card.component';
import { awaitOnce } from '@app/shared/utils/await-once.util';
import { Trip, Day } from '../trip.model';
import { Notes } from '../trip-detail/trip-day-swiper/general-panel/notes/notes.model';
import { AuthService } from '@app/core/services/business/auth.service';
import { GooglePlaceService } from '@app/core/services/api/google-place.service';
import { AutoCompleteComponent } from '@app/shared/components/form-fields/autocomplete/autocomplete.component';
import { PlaceSummary } from '@app/core/models/place.dto';
import { TripFacade } from '../trip-facade.service';
import { ViewportService } from '@app/core/services/ui/viewport.service';
import { DialogService } from '@app/shared/services/dialog.service';
import {
  TitleEditDialogComponent,
  TitleEditDialogData,
  TitleEditDialogResult,
} from '@app/shared/components/activity-card/activity-header/title-edit-dialog/title-edit-dialog.component';
import {
  SimpleTextEntryDialogComponent,
  SimpleTextEntryDialogData,
} from '@app/shared/components/overlays/simple-text-entry-dialog/simple-text-entry-dialog.component';
import { SelectButtonComponent } from '@app/shared/components/form-fields/select-button/select-button.component';
import { MessageComponent } from '@app/shared/components/feedback/message/message.component';
import { MultiCityFieldComponent } from '@app/shared/components/form-fields/multi-city-field/multi-city-field.component';
import { AiTripPreferencesComponent } from './ai-trip-preferences/ai-trip-preferences.component';
import { PullToRefreshDirective } from '@app/shared/directives/pull-to-refresh.directive';
import { PLANNING_MODE_OPTIONS, PlanningMode, TripAiPreferences, createDefaultAiPreferences } from './trip-ai-preferences.model';
import { TripGeneration } from './trip-generation.model';
import { TripGenerationRepository } from '@app/core/infra/firebase/services/trip-generation-repository';

@Component({
  selector: 'app-new-trip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, InputTextDirective, DatePickerComponent, ButtonComponent,
    CardComponent, AutoCompleteComponent, SelectButtonComponent, AiTripPreferencesComponent,
    MessageComponent, MultiCityFieldComponent, PullToRefreshDirective,
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
  private readonly tripGenerationRepository = inject(TripGenerationRepository);

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

  /** Carte "Je planifie moi-même" / "Laisser l'IA m'aider" (voir process-creation-trip-ia.md §2.2), affichée une fois Destination/Nom/Dates renseignés. Lot 1 : `aiPreferences` n'est jamais envoyé au backend, purement local au formulaire. */
  protected readonly planningModeOptions = PLANNING_MODE_OPTIONS;
  readonly planningMode = signal<PlanningMode>('manual');
  readonly aiPreferences = signal<TripAiPreferences>(createDefaultAiPreferences());
  /** Plusieurs destinations ? (ROADMAP.md "### UI") — saisissable en mode manuel ET IA, persisté sur `Trip.additionalCities` ; en mode IA, reversé dans `TripAiPreferences.cities`/`.multiCity` à la soumission (voir `onSubmit`), la Cloud Function de génération les géocode elle-même. */
  readonly additionalCities = signal<string[]>([]);

  /** `SelectButtonComponent.valueChange` type toujours `T | undefined` — en pratique toujours défini, un clic sélectionne forcément une des 2 options. */
  protected onPlanningModeChange(mode: PlanningMode | undefined): void {
    if (mode === undefined) return;
    this.planningMode.set(mode);
  }

  /**
   * Les 3 champs existants suffisent à afficher la 4ᵉ carte (voir §2.1/§2.2
   * de la spec) — pas besoin d'attendre une validation plus poussée (ex.
   * dates cohérentes), déjà vérifiée par `form.invalid` au submit. Méthode
   * simple (pas de `computed()`) : `form.value` n'est pas un signal, même
   * pattern que les erreurs de champ déjà lues inline dans le template
   * (`form.controls.ville.hasError(...)`), réévaluée à chaque passe de
   * détection de changements déclenchée par les événements du formulaire.
   */
  protected showPlanningModeCard(): boolean {
    const { title, ville, dates } = this.form.value;
    return !!title && !!ville && Array.isArray(dates) && dates.length === 2;
  }

  /** Réf photo Google Places de la destination sélectionnée, résolue automatiquement (voir `onSelect`) — pas d'action utilisateur, `undefined` si pas encore résolue/échec au moment du submit (non bloquant, voir ROADMAP.md "UX / Interactions"). */
  private readonly photoRef = signal<string | undefined>(undefined);

  /** Coordonnées de la destination sélectionnée via Google (voir `onSelect`) — nécessaires pour biaiser géographiquement la recherche Places du pipeline IA (§4.1). `undefined` si la ville a été saisie en texte libre (pas de sélection Google) : le mode IA est alors bloqué (voir `aiSubmitError`), la recherche élargie ne peut pas fonctionner sans point d'ancrage géographique. */
  private readonly destinationLocation = signal<{ latitude: number; longitude: number } | undefined>(undefined);

  /** Raison de blocage du mode IA au submit, affichée sous la carte manuel/IA — `null` si rien ne bloque. Réévalué à chaque rendu (pas un `computed()`, mêmes raisons que `showPlanningModeCard`). */
  protected aiSubmitError(): string | null {
    if (this.planningMode() !== 'ai') return null;
    if (!this.destinationLocation()) {
      return 'Choisis une destination dans les suggestions Google (pas juste un texte libre) pour que l\'IA puisse chercher des activités autour.';
    }
    return null;
  }

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

  /**
   * Ville → Nom → Dates, chacune ouvrant son tiroir dédié (voir
   * openVilleDialog/openNomDialog) — jamais bloquant si une étape est annulée
   * en cours de route. Ne soumet plus automatiquement une fois les dates
   * choisies (voir process-creation-trip-ia.md §2.1) : la 4ᵉ carte
   * manuel/IA doit encore pouvoir s'afficher, donc l'utilisateur tape
   * explicitement "Créer le voyage".
   */
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
    const range = await awaitOnce(datePicker.selected, this.destroyRef);
    if (!Array.isArray(range)) return;
    this.form.controls.dates.setValue(range);
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
        data: { initialTitle: this.form.value.ville ?? '', title: 'Où souhaites-tu aller ?', placeholder: 'Rechercher une ville...' },
        panelClass: 'app-wide-dialog-panel',
        viewContainerRef: this.viewContainerRef,
        autoFocus: '.title-edit-dialog__input',
      },
    );
    return awaitOnce(dialogRef.closed, this.destroyRef);
  }

  /** Tiroir mobile "Nom du voyage" — champ texte simple (pas de recherche Google, voir ROADMAP.md). */
  private openNomDialog(): Promise<string | undefined> {
    this.form.controls.title.markAsTouched();
    const dialogRef = this.dialogService.open<string | undefined, SimpleTextEntryDialogData>(
      SimpleTextEntryDialogComponent,
      {
        data: {
          initialValue: this.form.value.title ?? '',
          title: 'Donne un nom à ton voyage, tu pourras le changer plus tard',
          placeholder: 'Ex : Road trip Islande',
        },
        panelClass: 'app-wide-dialog-panel',
        viewContainerRef: this.viewContainerRef,
        // Sans ça, l'autofocus CDK par défaut ('first-tabbable') cible le
        // bouton de fermeture (1er élément focusable du template), pas le
        // champ — même correctif que TitleEditDialogComponent (retour
        // utilisateur, 2026-08-02).
        autoFocus: '.simple-text-entry-dialog__input',
      },
    );
    return awaitOnce(dialogRef.closed, this.destroyRef);
  }

  /** Réédition ponctuelle du champ Ville (retap du déclencheur mobile, hors chaînage initial) — voir template. */
  protected applyVilleResult(result: TitleEditDialogResult): void {
    if (result.type === 'place') {
      this.onSelect(result.place);
      return;
    }
    this.destinationLocation.set(undefined);
    this.form.controls.ville.setValue(result.text);
  }

  /** Réédition ponctuelle du champ Nom (retap du déclencheur mobile, hors chaînage initial) — voir template. */
  protected applyNomResult(text: string): void {
    this.form.controls.title.setValue(text);
    this.titleManuallyEdited = true;
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

    this.destinationLocation.set({ latitude: place.latitude, longitude: place.longitude });
    this.photoRef.set(undefined);
    this.googlePlaceService.getPlacePhotos$(place.placeId)
      .pipe(
        // On attend un état terminal (succès ou erreur), jamais "loading"/"idle".
        filter((state) => state.status === 'success' || state.status === 'error'),
        take(1),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((state) => {
        if (state.status === 'success') this.photoRef.set(state.data?.photos?.[0]?.name);
      });
  }

  onSearch(query: string): void {
    this.destinationLocation.set(undefined);
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
    if (this.aiSubmitError()) return;

    this.loading.set(true);

    const user = this.authService.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const [dateDebut, dateFin] = this.form.value.dates || [];

    const trip: Trip = {
      id: crypto.randomUUID(),
      title: this.form.value.title ?? '',
      ville: this.form.value.ville ?? '',
      placeId: this.form.value.placeId ?? '',
      ...(this.photoRef() ? { photoRef: this.photoRef() } : {}),
      ...(this.additionalCities().length > 0 ? { additionalCities: this.additionalCities() } : {}),
      days: this.buildDays(dateDebut, dateFin),
      activities: [],
      dayActivityInstances: [],
      logistics: [],
      expenses: [],
      notes: this.buildNote(),
      ownerId: user.uid,
      members: {
        [user.uid]: { role: 'owner', email: user.email ?? '', displayName: user.displayName ?? undefined },
      },
    };

    if (this.planningMode() === 'ai') {
      this.saveTripAndStartGeneration(trip);
    } else {
      this.saveTrip(trip);
    }
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

  /**
   * Mode IA (`activities_only` uniquement pour l'instant, voir `aiSubmitError`) :
   * le trip est créé exactement comme en mode manuel (mêmes days/activités
   * vides — voir process-creation-trip-ia.md §2.4, "le trip est créé en base"),
   * PUIS le job de génération (`tripGenerations/{tripId}`, collection séparée,
   * voir `TripGenerationRepository`) est créé à son tour — c'est cette
   * seconde écriture qui déclenche la Cloud Function de génération. Redirige
   * vers l'écran de génération plutôt que l'éditeur de voyage.
   */
  private saveTripAndStartGeneration(trip: Trip): void {
    const location = this.destinationLocation();
    if (!location) return; // garde déjà faite par aiSubmitError, ceinture-bretelles

    this.tripFacade.saveTrip(trip);

    const cities = this.additionalCities();

    const now = new Date();
    const job: TripGeneration = {
      tripId: trip.id,
      status: 'generating',
      // `cities`/`multiCity` du champ "plusieurs destinations ?", hoisté hors
      // de ce panneau (ROADMAP.md "### UI") — plus édités dans
      // AiTripPreferencesComponent, reversés ici depuis `additionalCities`.
      preferences: { ...this.aiPreferences(), multiCity: cities.length > 0, cities },
      destination: { ville: trip.ville, placeId: trip.placeId ?? '', latitude: location.latitude, longitude: location.longitude },
      tripDayDates: trip.days.map((d) => d.id.getTime()),
      candidates: [],
      preview: [],
      lodgingCandidates: [],
      lodgingPreview: [],
      transportSegments: [],
      generalNotes: [],
      createdAt: now,
      updatedAt: now,
    };

    this.tripGenerationRepository.create(job)
      .then(() => this.router.navigate([`/trips/${trip.id}/generating`]))
      .catch((err) => {
        // Le trip lui-même est déjà créé (saveTrip ci-dessus, optimiste) : on
        // n'échoue pas toute la création pour un souci sur le SEUL job IA,
        // on retombe simplement sur l'éditeur de voyage classique.
        console.error('[NewTripComponent] tripGeneration create error', err);
        this.router.navigate([`/trips/${trip.id}`]);
      });
  }

  onCancel(): void {
    this.router.navigate(['/trips']);
  }
}