import { ChangeDetectionStrategy, Component, ViewContainerRef, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DialogRef } from '@angular/cdk/dialog';
import { format } from 'date-fns';
import { filter, finalize, firstValueFrom, take } from 'rxjs';
import { DatePickerComponent } from '@app/shared/components/date-picker/date-picker.component';
import { DialogService } from '@app/shared/services/dialog.service';
import { ConfirmDialogService } from '@app/shared/services/confirm-dialog.service';
import { GooglePlaceService } from '@app/core/services/google-place.service';
import {
  SimpleTextEntryDialogComponent,
  SimpleTextEntryDialogData,
} from '@app/shared/components/simple-text-entry-dialog/simple-text-entry-dialog.component';
import {
  TitleEditDialogComponent,
  TitleEditDialogData,
  TitleEditDialogResult,
} from '@app/shared/components/activity-card/activity-header/title-edit-dialog/title-edit-dialog.component';
import {
  TravelTiersDialogComponent,
  TravelTiersDialogData,
} from './travel-tiers-dialog/travel-tiers-dialog.component';
import {
  MultiCityDialogComponent,
  MultiCityDialogData,
} from './multi-city-dialog/multi-city-dialog.component';
import {
  CollaboratorsDialogComponent,
  CollaboratorsDialogData,
} from '@app/shared/components/collaborators-dialog/collaborators-dialog.component';
import { AuthService } from '@app/core/services/auth.service';
import { UserProfileService } from '@app/core/services/user-profile.service';
import { TripFacade } from '../trip-facade.service';
import { Day, TravelTiers } from '../trip.model';
import { ButtonComponent } from '@app/shared/components/button/button.component';

const MODE_LABEL: Record<TravelTiers['tier1Mode'], string> = { walk: 'Marche', bike: 'Vélo', car: 'Voiture' };
/** Voir la doc équivalente historique dans `TripHeaderComponent` (avant ce déplacement) : `nt-icon-*` maison pour marche/vélo (aucun glyphe PrimeIcons adéquat), `pi-car` pour voiture. */
const MODE_ICON: Record<TravelTiers['tier1Mode'], string> = { walk: 'nt-icon-walk', bike: 'nt-icon-bike', car: 'pi pi-car' };

/**
 * Section "Voyage" : regroupe TOUTE l'édition du voyage courant (titre,
 * dates, participants, paliers de trajet, destinations additionnelles,
 * suppression). Projetée dans le drawer local de `TripHeaderComponent`
 * (`app-menu`, monté uniquement dans l'onglet Résumé — ROADMAP.md "### UI",
 * 2026-08-13, remplace la section "Voyage" du menu réglages global de la
 * roue crantée) : contrairement à ce précédent emplacement, ce composant
 * n'a plus besoin d'être utilisable depuis N'IMPORTE QUEL onglet, ni de
 * fermer un menu ailleurs dans l'arbre à la suppression du trip (la
 * navigation vers `/trips` détruit ce composant et son drawer parent
 * directement, voir `MenuComponent.ngOnDestroy`).
 */
@Component({
  selector: 'app-trip-settings-section',
  standalone: true,
  imports: [ReactiveFormsModule, DatePickerComponent, ButtonComponent],
  templateUrl: './trip-settings-section.component.html',
  styleUrl: './trip-settings-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripSettingsSectionComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogService = inject(DialogService);
  private readonly confirmDialogService = inject(ConfirmDialogService);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly authService = inject(AuthService);
  private readonly userProfileService = inject(UserProfileService);
  private readonly googlePlaceService = inject(GooglePlaceService);
  private readonly router = inject(Router);
  protected readonly tripFacade = inject(TripFacade);

  readonly tripId = input.required<string>();

  protected readonly title = computed(() => this.tripFacade.getTripTitle(this.tripId())());
  protected readonly destination = computed(() => this.tripFacade.getTripDestination(this.tripId())());
  protected readonly dateRange = computed(() => this.tripFacade.getTripDateRange(this.tripId())());
  protected readonly tiers = computed(() => this.tripFacade.getTripTravelTiers(this.tripId())());
  protected readonly additionalCities = computed(() => this.tripFacade.getTripAdditionalCities(this.tripId())());
  /** Destination principale COMPRISE (toujours en 1ère position) — voir `openDestinationsDialog`, popup fusionnée "Destinations" (ROADMAP.md "### UI", fusion 2026-08-13). */
  protected readonly destinationsLabel = computed(() => [this.destination().ville, ...this.additionalCities()].join(', '));
  protected readonly members = computed(() => this.tripFacade.getTripMembers(this.tripId())());

  protected readonly currentUserId = computed(() => this.authService.getCurrentUser()?.uid ?? '');
  protected readonly isOwner = computed(() => this.members()[this.currentUserId()]?.role === 'owner');

  protected readonly participantsLabel = computed(() =>
    Object.values(this.members()).map(m => m.displayName || m.email).join(', ') || '—',
  );

  protected readonly dateRangeLabel = computed(() => {
    const range = this.dateRange();
    if (!range) return '—';
    const [start, end] = range;
    return `du ${format(start, 'dd/MM/yyyy')} au ${format(end, 'dd/MM/yyyy')}`;
  });

  protected modeIcon(mode: TravelTiers['tier1Mode']): string {
    return MODE_ICON[mode];
  }

  protected fmtKm(km: number): string {
    return Number.isInteger(km) ? String(km) : km.toString().replace('.', ',');
  }

  /** Équivalent texte du libellé icônes-seules (lecteurs d'écran) — même ordre que l'ancien `TripHeaderComponent.travelTiersAriaLabel`. */
  protected readonly travelTiersAriaLabel = computed(() => {
    const tiers = this.tiers();
    return `Trajets : ${MODE_LABEL[tiers.tier1Mode]} ≤ ${this.fmtKm(tiers.tier1MaxKm)} km, ${MODE_LABEL[tiers.tier2Mode]} ≤ ${this.fmtKm(tiers.tier2MaxKm)} km, ${MODE_LABEL[tiers.tier3Mode]} sinon`;
  });

  private readonly datePickerRef = viewChild(DatePickerComponent);

  readonly dateForm = this.fb.group({
    dates: this.fb.control<Date[] | null>(null),
  });

  private readonly addLoading = signal(false);
  private readonly addError = signal<string | null>(null);
  private collaboratorsDialogRef?: DialogRef<void, CollaboratorsDialogComponent>;

  constructor() {
    // Resynchronise le form caché à chaque changement réel de `dateRange` —
    // même raisonnement que l'ancien `TripHeaderComponent` (voir sa doc
    // historique) : `dateRange` est un signal dédié, protégé pendant le
    // debounce, contrairement à `FormGroup.value` qui ne serait pas réactif.
    effect(() => {
      const range = this.dateRange();
      if (!range) return;
      this.patchFromRange(range);
    });
  }

  protected openTitleDialog(): void {
    const dialogRef = this.dialogService.open<string | undefined, SimpleTextEntryDialogData>(
      SimpleTextEntryDialogComponent,
      {
        data: { initialValue: this.title(), placeholder: 'Titre du voyage', title: 'Titre' },
        panelClass: 'app-wide-dialog-panel',
        viewContainerRef: this.viewContainerRef,
        autoFocus: '.simple-text-entry-dialog__input',
      },
    );

    dialogRef.closed.subscribe((result) => {
      if (result === undefined) return;
      const trimmed = result.trim();
      if (!trimmed || trimmed === this.title()) return;
      this.tripFacade.updateTripTitle(this.tripId(), trimmed);
    });
  }

  /**
   * Recherche Google + résolution photo pour une NOUVELLE destination
   * principale (`Trip.ville`/`placeId`/`photoRef`) — réutilise
   * `TitleEditDialogComponent` (recherche Google + texte libre) exactement
   * comme `MultiCityFieldComponent.onCityTriggerClick` : seul le résultat
   * `type === 'place'` est exploitable ici, la destination principale a
   * BESOIN d'un `placeId` réel (photo de couverture, carte du jour sans
   * activité, voir `TripDayMapComponent`) — jamais de résolution "à
   * l'aveugle" à partir d'un simple nom de ville tapé/promu (voir
   * `openDestinationsDialog`, seul appelant : une ville "additionnelle" n'a
   * jamais de `placeId` connu côté client, voir `MultiCityFieldComponent`).
   *
   * Ne fait AUCUNE écriture elle-même (retourne la destination résolue, ou
   * `undefined` si annulé/texte libre) : laisse l'appelant l'appliquer avec
   * ce qu'il a d'autre à committer en même temps (ex. `additionalCities`),
   * pour ne jamais mettre le trip dans un état intermédiaire incohérent si
   * l'utilisateur annule cette étape.
   */
  private async resolveNewDestination(
    initialTitle: string,
  ): Promise<{ ville: string; placeId: string; photoRef?: string } | undefined> {
    const dialogRef = this.dialogService.open<TitleEditDialogResult | undefined, TitleEditDialogData>(
      TitleEditDialogComponent,
      {
        data: { initialTitle, title: 'Destination principale', placeholder: 'Rechercher une ville...' },
        panelClass: 'app-wide-dialog-panel',
        viewContainerRef: this.viewContainerRef,
        autoFocus: '.title-edit-dialog__input',
      },
    );
    const result = await new Promise<TitleEditDialogResult | undefined>((resolve) => {
      const sub = dialogRef.closed.subscribe((value) => {
        sub.unsubscribe();
        resolve(value);
      });
    });
    if (!result || result.type !== 'place') return undefined;

    const place = result.place;
    // On attend un état terminal (succès ou erreur), jamais "loading"/"idle" — même pattern que NewTripComponent.onSelect.
    const state = await firstValueFrom(
      this.googlePlaceService.getPlacePhotos$(place.placeId).pipe(
        filter((s) => s.status === 'success' || s.status === 'error'),
        take(1),
      ),
    );
    const photoRef = state.status === 'success' ? state.data?.photos?.[0]?.name : undefined;
    return { ville: place.name, placeId: place.placeId, photoRef };
  }

  protected openDatePicker(): void {
    this.datePickerRef()?.openPanel();
  }

  protected openTravelTiersDialog(): void {
    const dialogRef = this.dialogService.open<TravelTiers | undefined, TravelTiersDialogData>(
      TravelTiersDialogComponent,
      {
        data: { initialValue: this.tiers() },
        panelClass: 'app-wide-dialog-panel',
        viewContainerRef: this.viewContainerRef,
      },
    );

    dialogRef.closed.subscribe((result) => {
      if (result === undefined) return;
      this.tripFacade.updateTripTravelTiers(this.tripId(), result);
    });
  }

  /**
   * Popup fusionnée "Destinations" (ROADMAP.md "### UI", retour utilisateur
   * 2026-08-13 : "il faut fusionner principales et additionnels") — remplace
   * les 2 anciennes lignes séparées "Destination principale"/"Destinations
   * additionnelles" par une seule, la principale COURANTE occupant toujours
   * la 1ère position de la liste éditée (`MultiCityDialogComponent`, liste
   * plate de noms, aucune distinction visuelle de position). Pleinement
   * éditable : l'utilisateur peut retirer/réordonner y compris cette 1ère
   * entrée (décision actée avec l'utilisateur le 2026-08-13, ROADMAP.md).
   *
   * Interprétation au relâchement : `résultat[0]` (quel qu'il soit) devient
   * la NOUVELLE destination principale, `résultat[1..]` les additionnelles —
   * si `résultat[0]` est inchangé (même nom que la principale AVANT
   * édition), rien à résoudre, seules les additionnelles sont mises à jour.
   * Sinon (nouvelle ville en 1ère position, tapée ou promue depuis une
   * ancienne additionnelle), une résolution Google Place dédiée est
   * nécessaire AVANT d'appliquer quoi que ce soit — voir
   * `resolveNewDestination` : un nom de ville "additionnelle" n'a jamais de
   * `placeId` connu côté client (`MultiCityFieldComponent` ne conserve que
   * des strings), impossible de rafraîchir la photo de couverture sans
   * repasser par une vraie recherche Google, jamais une résolution
   * silencieuse/à l'aveugle (risque d'homonymie entre villes). Annuler cette
   * étape abandonne TOUT le geste (ni la ville ni les additionnelles ne
   * changent) plutôt que de committer un état à moitié cohérent.
   */
  protected openDestinationsDialog(): void {
    const dialogRef = this.dialogService.open<string[] | undefined, MultiCityDialogData>(
      MultiCityDialogComponent,
      {
        data: { initialCities: [this.destination().ville, ...this.additionalCities()] },
        panelClass: 'app-wide-dialog-panel',
        viewContainerRef: this.viewContainerRef,
      },
    );

    dialogRef.closed.subscribe(async (result) => {
      if (result === undefined || result.length === 0) return;
      const [newVille, ...newAdditionalCities] = result;

      if (newVille === this.destination().ville) {
        this.tripFacade.updateTripAdditionalCities(this.tripId(), newAdditionalCities);
        return;
      }

      const resolved = await this.resolveNewDestination(newVille);
      if (!resolved) return;
      this.tripFacade.updateTripDestination(this.tripId(), resolved);
      this.tripFacade.updateTripAdditionalCities(this.tripId(), newAdditionalCities);
    });
  }

  protected openParticipantsDialog(): void {
    this.addError.set(null);
    const data: CollaboratorsDialogData = {
      members: this.members,
      currentUserId: this.currentUserId,
      isOwner: this.isOwner,
      companions: this.userProfileService.companions,
      addLoading: this.addLoading,
      addError: this.addError,
      onAdd: (email) => this.onAddCollaborator(email),
      onRemove: (uid) => this.onRemoveCollaborator(uid),
      onRemoveCompanion: (uid) => this.onRemoveCompanion(uid),
    };
    this.collaboratorsDialogRef = this.dialogService.open<void, CollaboratorsDialogData, CollaboratorsDialogComponent>(
      CollaboratorsDialogComponent,
      { data, viewContainerRef: this.viewContainerRef },
    );
  }

  protected confirmDeleteTrip(): void {
    this.confirmDialogService.confirm({
      message: 'Êtes-vous sûr de vouloir supprimer ce voyage ? Il sera perdu définitivement.',
      header: 'Confirmation',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Oui',
      rejectLabel: 'Non',
      accept: () => {
        this.tripFacade.removeTrip(this.tripId());
        this.router.navigate(['/trips']);
      },
    });
  }

  protected onDatesSelected(): void {
    const dates = this.dateForm.value.dates;
    if (!dates || !dates[0] || !dates[1]) return;
    this.applyDateRange([dates[0], dates[1]]);
  }

  private onAddCollaborator(email: string): void {
    this.addLoading.set(true);
    this.addError.set(null);

    this.tripFacade
      .addCollaborator(this.tripId(), email)
      .pipe(finalize(() => this.addLoading.set(false)))
      .subscribe({
        next: () => this.collaboratorsDialogRef?.close(),
        error: (err) => {
          const message = err?.error?.error ?? err?.message ?? 'Une erreur est survenue';
          this.addError.set(message);
        },
      });
  }

  private onRemoveCollaborator(memberUid: string): void {
    this.tripFacade.removeCollaborator(this.tripId(), memberUid).subscribe({
      error: (err) => console.error('[TripSettingsSection] Erreur suppression collaborateur', err),
    });
  }

  private onRemoveCompanion(companionUid: string): void {
    this.userProfileService.removeCompanion(companionUid).subscribe({
      error: (err) => console.error('[TripSettingsSection] Erreur suppression companion', err),
    });
  }

  /** Reprend `TripSummaryComponent.onDatesChange`/`buildDays`/`findDaysToAdd`/`findDaysToDelete` (avant ce déplacement) — voir leur doc historique pour le raisonnement complet. */
  private applyDateRange(range: [Date, Date]): void {
    const trip = this.tripFacade.activeTrip();
    if (!trip || trip.id !== this.tripId()) return;

    const [start, end] = range;
    const newDays = this.buildDays(start, end, trip.days);
    const toDelete = this.findDaysToDelete(trip.days, newDays);
    const toAdd = this.findDaysToAdd(trip.days, newDays);

    const applyChanges = () => {
      for (const day of toDelete) this.tripFacade.removeDay(trip.id, day.id);
      for (const day of toAdd) this.tripFacade.addDay(trip.id, day);
    };

    if (toDelete.length > 0) {
      this.confirmDialogService.confirm({
        message: 'Certains jours contiennent des activités et vont être supprimés. Êtes-vous sûr de vouloir continuer ?',
        accept: applyChanges,
        reject: () => {
          const current = this.dateRange();
          if (current) this.patchFromRange(current);
        },
      });
    } else {
      applyChanges();
    }
  }

  private buildDays(start: Date, end: Date, existingDays: Day[]): Day[] {
    const days: Day[] = [];
    const existingMap = new Map(existingDays.map(day => [day.id.getTime(), day]));

    const current = new Date(start);
    current.setHours(0, 0, 0, 0);
    const endNorm = new Date(end);
    endNorm.setHours(0, 0, 0, 0);

    while (current <= endNorm) {
      const key = current.getTime();
      days.push(existingMap.get(key) ?? { id: new Date(current), activityIds: [] });
      current.setDate(current.getDate() + 1);
    }
    return days;
  }

  private findDaysToAdd(existingDays: Day[], newDays: Day[]): Day[] {
    const existingIds = new Set(existingDays.map(d => d.id.getTime()));
    return newDays.filter(d => !existingIds.has(d.id.getTime()));
  }

  private findDaysToDelete(existingDays: Day[], newDays: Day[]): Day[] {
    const newIds = new Set(newDays.map(d => d.id.getTime()));
    return existingDays.filter(d => !newIds.has(d.id.getTime()));
  }

  private patchFromRange([start, end]: [Date, Date]): void {
    this.dateForm.patchValue({ dates: [start, end] }, { emitEvent: false });
  }
}
