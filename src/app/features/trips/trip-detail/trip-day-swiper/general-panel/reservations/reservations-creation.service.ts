import { Injectable, Injector, ViewContainerRef, afterNextRender, inject, signal } from '@angular/core';
import { ReservationCardComponent } from './reservation-card/reservation-card.component';
import {
  TitleEditDialogComponent,
  TitleEditDialogData,
  TitleEditDialogResult,
} from '@app/shared/components/activity-card/activity-header/title-edit-dialog/title-edit-dialog.component';
import { DialogService } from '@app/shared/services/dialog.service';
import { ViewportService } from '@core/services/viewport.service';
import { Reservation } from '@core/models/reservation.dto';
import { TripFacade } from '@app/features/trips/trip-facade.service';

export interface ReservationsCreationConfig {
  getCards: () => readonly ReservationCardComponent[];
  getTripId: () => string;
  getViewContainerRef: () => ViewContainerRef;
}

/**
 * Orchestration du bouton "+" flottant pour les réservations — même pattern
 * que `TripActivitiesCreationService` (pool général des activités) : la
 * création réelle n'est déclenchée qu'une fois un nom connu, jamais avant.
 * Mobile : tiroir plein écran (`TitleEditDialogComponent`, réutilisé tel
 * quel). Desktop : `draftActive` piloté ici, consommé par
 * `ReservationsListComponent` pour afficher `NewReservationDraftComponent` à
 * la place de la future carte. Type par défaut 'other' (le plus générique,
 * ne bloque sur aucun champ obligatoire) — modifiable ensuite dans la carte
 * dépliée.
 *
 * Fourni par `ReservationsListComponent` (pas root).
 */
@Injectable()
export class ReservationsCreationService {
  private readonly dialogService = inject(DialogService);
  private readonly viewport = inject(ViewportService);
  private readonly tripFacade = inject(TripFacade);
  private readonly injector = inject(Injector);

  private config!: ReservationsCreationConfig;

  /** Desktop uniquement : `NewReservationDraftComponent` est affiché tant que ce signal est vrai. */
  readonly draftActive = signal(false);

  connect(config: ReservationsCreationConfig): void {
    this.config = config;
  }

  /** Point d'entrée unique du "+" flottant sur le sous-onglet Réservations. */
  startCreation(): void {
    if (this.viewport.isMobile()) {
      this.startMobileCreation();
    } else {
      this.draftActive.set(true);
    }
  }

  /** Câblé sur `(confirmed)` de `NewReservationDraftComponent` (desktop). */
  confirmDraft(title: string): void {
    this.draftActive.set(false);
    this.createReservation(title);
  }

  /** Câblé sur `(cancelled)` de `NewReservationDraftComponent` (desktop) : rien n'a jamais été créé. */
  cancelDraft(): void {
    this.draftActive.set(false);
  }

  private startMobileCreation(): void {
    const dialogRef = this.dialogService.open<TitleEditDialogResult | undefined, TitleEditDialogData>(
      TitleEditDialogComponent,
      {
        data: { initialTitle: '' },
        panelClass: 'app-title-edit-dialog-panel',
        viewContainerRef: this.config.getViewContainerRef(),
      },
    );

    dialogRef.closed.subscribe((result) => {
      if (!result) return; // croix : rien n'est créé
      const title = result.type === 'place' ? this.extractPlaceName(result.place.name) : result.text;
      this.createReservation(title);
    });
  }

  private extractPlaceName(name: unknown): string {
    if (typeof name === 'string') return name;
    if (name && typeof name === 'object' && typeof (name as { text?: unknown }).text === 'string') {
      return (name as { text: string }).text;
    }
    return '';
  }

  private createReservation(title: string): void {
    const id = crypto.randomUUID();
    const now = new Date();

    const reservation: Reservation = {
      id,
      type: 'other',
      title,
      startDateTime: now,
      endDateTime: now,
      files: [],
      links: [],
    };

    this.tripFacade.createReservation(this.config.getTripId(), reservation);

    afterNextRender(() => {
      const card = this.config.getCards().find((c) => c.reservationId() === id);
      card?.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, { injector: this.injector });
  }
}
