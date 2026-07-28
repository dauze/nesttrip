import { Injectable, Injector, ViewContainerRef, afterNextRender, inject, signal } from '@angular/core';

import { ActivityCardComponent } from '@app/shared/components/activity-card/activity-card.component';
import {
  TitleEditDialogComponent,
  TitleEditDialogData,
  TitleEditDialogResult,
} from '@app/shared/components/activity-card/activity-header/title-edit-dialog/title-edit-dialog.component';
import { DialogService } from '@app/shared/services/dialog.service';
import { ViewportService } from '@app/core/services/viewport.service';
import { PlaceSummary } from '@app/core/models/place.dto';
import { PoolActivity, DayActivityInstance } from '@app/shared/components/activity-card/activity.model';
import { TripFacade } from '@app/features/trips/trip-facade.service';
import { ActivityType } from '@core/enums/activites-type.enum';
import { BookingStatus } from '@core/enums/booking.status';
import { DayScrollSyncService } from './day-scroll-sync.service';

export interface DayActivityCreationConfig {
  getCards: () => readonly ActivityCardComponent[];
  getTripId: () => string;
  getDayId: () => Date;
  /** Injecteur d'ancrage du dialog mobile (voir la doc de `ActivityHeaderComponent.openTitleEditDialog` sur pourquoi c'est nécessaire — `GooglePlaceService` doit rester résolvable). */
  getViewContainerRef: () => ViewContainerRef;
}

/** Titre saisi à la création, texte libre ou lieu Google — voir `startCreation`. */
interface CreationTitle {
  title: string;
  place?: PlaceSummary;
}

/**
 * Orchestration du bouton "+" d'un jour : la création réelle (pool + instance,
 * voir CLAUDE.md/TripStore) n'est déclenchée qu'une fois le nom de l'activité
 * connu, jamais avant — voir ROADMAP.md et la demande utilisateur associée.
 * Mobile : tiroir plein écran (`TitleEditDialogComponent`, réutilisé tel quel)
 * puis, une fois créée, scroll vers la nouvelle carte + chaînage de saisie
 * guidée Type→Résa→Début→Fin→Prix (voir `ActivityCardComponent.startGuidedEntry`).
 * Desktop : `draftActive` piloté ici, consommé par `DayPanelComponent` pour
 * afficher `NewActivityDraftComponent` à la place de la carte, sans chaînage.
 *
 * Fourni par `DayPanelComponent` (pas root), aux côtés de
 * `DayScrollSyncService`/`DayReorderService` — même pattern `connect(config)`.
 */
@Injectable()
export class DayActivityCreationService {
  private readonly dialogService = inject(DialogService);
  private readonly viewport = inject(ViewportService);
  private readonly tripFacade = inject(TripFacade);
  private readonly scrollSync = inject(DayScrollSyncService);
  private readonly injector = inject(Injector);

  private config!: DayActivityCreationConfig;

  /** Desktop uniquement : `NewActivityDraftComponent` est affiché tant que ce signal est vrai. */
  readonly draftActive = signal(false);

  /** Branche le service sur cette instance de DayPanelComponent — à appeler une seule fois (constructeur). */
  connect(config: DayActivityCreationConfig): void {
    this.config = config;
  }

  /** Point d'entrée unique du bouton "+" d'un jour. */
  startCreation(): void {
    if (this.viewport.isMobile()) {
      this.startMobileCreation();
    } else {
      this.draftActive.set(true);
    }
  }

  /** Câblé sur `(confirmed)` de `NewActivityDraftComponent` (desktop). */
  confirmDraft(result: CreationTitle): void {
    this.draftActive.set(false);
    this.createActivity(result);
  }

  /** Câblé sur `(cancelled)` de `NewActivityDraftComponent` (desktop) : rien n'a jamais été créé. */
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

      const creation: CreationTitle =
        result.type === 'place'
          ? { title: result.place.name, place: result.place }
          : { title: result.text };

      this.createActivity(creation, { guided: true });
    });
  }

  private createActivity(result: CreationTitle, options: { guided?: boolean } = {}): void {
    const poolId = crypto.randomUUID();
    const instanceId = crypto.randomUUID();
    const place = result.place;

    const poolActivity: PoolActivity = {
      id: poolId,
      title: result.title,
      placeId: place?.placeId ?? '',
      address: place?.address,
      latitude: place?.latitude,
      longitude: place?.longitude,
      files: [],
      photoRefs: [],
    };

    const instance: DayActivityInstance = {
      id: instanceId,
      activityId: poolId,
      type: ActivityType.ACTIVITE,
      duration: 0,
      price: { amount: 0, currency: this.tripFacade.activeTrip()?.defaultCurrency ?? 'EUR' },
      booking: { status: BookingStatus.NOT_NEEDED, deadline: undefined },
      notes: '',
    };

    this.tripFacade.createActivity(this.config.getTripId(), this.config.getDayId(), poolActivity, instance);

    // Un `queueMicrotask` s'exécute AVANT qu'Angular n'ait rendu la nouvelle
    // carte issue du `@for` (le viewChildren(ActivityCardComponent) de
    // DayPanelComponent n'est donc pas encore à jour) — `afterNextRender`,
    // lui, attend le prochain rendu réel, garanti après la mise à jour du DOM.
    afterNextRender(() => {
      const card = this.config.getCards().find((c) => c.activityId() === instanceId);
      if (!card) return;

      if (place) card.onPlaceSelected(place);

      // `startGuidedEntry` n'ouvre le panneau "Type" qu'APRÈS la fin du
      // scroll (`onComplete`, pas juste après son lancement) : ce panneau
      // s'ancre (CDK) à la position du champ au moment de l'ouverture et ne
      // suit pas le scroll programmatique en cours — l'ouvrir plus tôt le
      // désancre visuellement dès que le scroll continue.
      this.scrollSync.focusActivity(instanceId, () => {
        if (options.guided) card.startGuidedEntry();
      });
    }, { injector: this.injector });
  }
}
