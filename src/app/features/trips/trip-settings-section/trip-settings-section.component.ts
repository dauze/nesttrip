import { ChangeDetectionStrategy, Component, ViewContainerRef, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DialogRef } from '@angular/cdk/dialog';
import { format } from 'date-fns';
import { finalize } from 'rxjs';
import { DatePickerComponent } from '@app/shared/components/date-picker/date-picker.component';
import { DialogService } from '@app/shared/services/dialog.service';
import { ConfirmDialogService } from '@app/shared/services/confirm-dialog.service';
import {
  SimpleTextEntryDialogComponent,
  SimpleTextEntryDialogData,
} from '@app/shared/components/simple-text-entry-dialog/simple-text-entry-dialog.component';
import {
  TravelTiersDialogComponent,
  TravelTiersDialogData,
} from '../trip-detail/trip-header/travel-tiers-dialog/travel-tiers-dialog.component';
import {
  CollaboratorsDialogComponent,
  CollaboratorsDialogData,
} from '@app/shared/components/collaborators-dialog/collaborators-dialog.component';
import { AuthService } from '@app/core/services/auth.service';
import { UserProfileService } from '@app/core/services/user-profile.service';
import { AppSettingsMenuService } from '@app/core/services/app-settings-menu.service';
import { TripFacade } from '../trip-facade.service';
import { Day, TravelTiers } from '../trip.model';

const MODE_LABEL: Record<TravelTiers['tier1Mode'], string> = { walk: 'Marche', bike: 'Vélo', car: 'Voiture' };
/** Voir la doc équivalente historique dans `TripHeaderComponent` (avant ce déplacement) : `nt-icon-*` maison pour marche/vélo (aucun glyphe PrimeIcons adéquat), `pi-car` pour voiture. */
const MODE_ICON: Record<TravelTiers['tier1Mode'], string> = { walk: 'nt-icon-walk', bike: 'nt-icon-bike', car: 'pi pi-car' };

/**
 * Section "Voyage" du menu réglages (roue crantée, voir `TripsComponent`) —
 * regroupe TOUTE l'édition du voyage courant (titre, dates, participants,
 * paliers de trajet, suppression), reprise à l'identique de l'ancien
 * `TripHeaderComponent`/`TripCollaboratorsComponent`/`TripSummaryComponent`
 * (ROADMAP.md, "Le trip header doit évoluer") mais déplacée ici pour rester
 * utilisable depuis N'IMPORTE QUEL onglet d'un voyage : le menu réglages est
 * un élément global de la toolbar (`TripsComponent`), alors que
 * `TripHeaderComponent` n'est monté que dans l'onglet Résumé.
 */
@Component({
  selector: 'app-trip-settings-section',
  standalone: true,
  imports: [ReactiveFormsModule, DatePickerComponent],
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
  private readonly appSettingsMenuService = inject(AppSettingsMenuService);
  private readonly router = inject(Router);
  protected readonly tripFacade = inject(TripFacade);

  readonly tripId = input.required<string>();

  protected readonly title = computed(() => this.tripFacade.getTripTitle(this.tripId())());
  protected readonly dateRange = computed(() => this.tripFacade.getTripDateRange(this.tripId())());
  protected readonly tiers = computed(() => this.tripFacade.getTripTravelTiers(this.tripId())());
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
        this.appSettingsMenuService.requestClose();
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
