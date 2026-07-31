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
import { PoolActivity } from '@app/shared/components/activity-card/activity.model';
import { TripFacade } from '@app/features/trips/trip-facade.service';

export interface TripActivitiesCreationConfig {
  getCards: () => readonly ActivityCardComponent[];
  getTripId: () => string;
  getViewContainerRef: () => ViewContainerRef;
  /** Texte courant de la barre de recherche/filtre (voir ROADMAP.md) : préremplit le titre à la création plutôt que de le perdre. */
  getSearchTerm: () => string;
}

/** Titre saisi à la création, texte libre ou lieu Google — voir `startCreation`. */
interface CreationTitle {
  title: string;
  place?: PlaceSummary;
}

/**
 * Équivalent de `DayActivityCreationService` pour le pool général du trip
 * (onglet "Général" — voir TripActivitiesComponent) : même report de la
 * création réelle au moment où le nom est connu (mobile : tiroir dédié,
 * desktop : champ inline focus auto). Pas de chaînage de saisie guidée ici :
 * `ActivityFormComponent` n'est jamais monté hors contexte jour (voir
 * ActivityCardComponent.startGuidedEntry, no-op dans ce contexte), et pas de
 * `DayScrollSyncService` (spécifique au scroll↔carte d'un jour) — le scroll
 * vers la nouvelle carte utilise un simple `scrollIntoView`.
 *
 * Fourni par `TripActivitiesComponent` (pas root).
 */
@Injectable()
export class TripActivitiesCreationService {
  private readonly dialogService = inject(DialogService);
  private readonly viewport = inject(ViewportService);
  private readonly tripFacade = inject(TripFacade);
  private readonly injector = inject(Injector);

  private config!: TripActivitiesCreationConfig;

  /** Desktop uniquement : `NewActivityDraftComponent` est affiché tant que ce signal est vrai. */
  readonly draftActive = signal(false);

  /**
   * Mobile uniquement : `true` tant que le tiroir de saisie du titre est
   * ouvert — sans ce garde-fou, un double-tap rapide sur le "+" (le temps que
   * le premier tiroir se peigne réellement) ouvrait un second
   * `TitleEditDialogComponent` en parallèle, et une confirmation de chacun
   * créait deux `PoolActivity` distinctes pour le même geste (voir
   * ROADMAP.md, "la création d'une activité l'a créé en double") — même
   * classe de course que celle déjà corrigée sur `DayActivityCreationService`/
   * `LogisticsCreationService` (`creatingInstanceId`/`creatingId`), sauf qu'ici
   * la fenêtre à protéger est AVANT la création (l'ouverture du dialog), pas
   * après.
   */
  private mobileDialogOpen = false;

  /** Branche le service sur cette instance de TripActivitiesComponent — à appeler une seule fois (constructeur). */
  connect(config: TripActivitiesCreationConfig): void {
    this.config = config;
  }

  /** Point d'entrée unique du bouton "+" du pool général. */
  startCreation(): void {
    if (this.viewport.isMobile()) {
      if (this.mobileDialogOpen) return;
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
    this.mobileDialogOpen = true;
    const dialogRef = this.dialogService.open<TitleEditDialogResult | undefined, TitleEditDialogData>(
      TitleEditDialogComponent,
      {
        data: { initialTitle: this.config.getSearchTerm() },
        panelClass: 'app-wide-dialog-panel',
        viewContainerRef: this.config.getViewContainerRef(),
      },
    );

    dialogRef.closed.subscribe((result) => {
      this.mobileDialogOpen = false;
      if (!result) return; // croix : rien n'est créé

      const creation: CreationTitle =
        result.type === 'place'
          ? { title: result.place.name, place: result.place }
          : { title: result.text };

      this.createActivity(creation);
    });
  }

  private createActivity(result: CreationTitle): void {
    const poolId = crypto.randomUUID();
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

    this.tripFacade.createGeneralActivity(this.config.getTripId(), poolActivity);

    // `afterNextRender` (pas `queueMicrotask`) : attend le rendu réel de la
    // nouvelle carte avant de la résoudre via viewChildren — voir la même
    // correction sur DayActivityCreationService.
    afterNextRender(() => {
      const card = this.config.getCards().find((c) => c.activityId() === poolId);
      if (!card) return;

      if (place) card.onPlaceSelected(place);

      card.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, { injector: this.injector });
  }
}
