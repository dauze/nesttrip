import { Injectable, Injector, afterNextRender, inject, signal } from '@angular/core';
import { LogisticCardComponent } from './logistic-card/logistic-card.component';
import { BookingStatus } from '@core/enums/booking.status';
import { Logistic, LogisticType } from '@core/models/logistic.dto';
import { TripFacade } from '@app/features/trips/trip-facade.service';

export interface LogisticsCreationConfig {
  getCards: () => readonly LogisticCardComponent[];
  getTripId: () => string;
}

/**
 * Orchestration du bouton "+" flottant du sous-onglet Logistique : crée
 * immédiatement un élément (type provisoire 'other', titre vide) puis
 * enchaîne sur la cinématique de saisie guidée (`LogisticDetailsComponent.startGuidedEntry`,
 * qui demande le type EN PREMIER — voir ROADMAP.md). Mobile uniquement, comme
 * le chaînage guidé des activités : `startGuidedEntry` no-op sur desktop
 * (formulaire déjà entièrement visible, l'utilisateur renseigne les champs
 * à son rythme sans ordre imposé) — appelé ici inconditionnellement, c'est
 * la méthode elle-même qui filtre.
 *
 * Fourni par `LogisticsListComponent` (pas root).
 */
@Injectable()
export class LogisticsCreationService {
  private readonly tripFacade = inject(TripFacade);
  private readonly injector = inject(Injector);

  private config!: LogisticsCreationConfig;

  /**
   * Id de l'élément en cours de création, tant que sa carte n'a pas encore
   * été retrouvée dans `getCards()` — voir la doc équivalente sur
   * `DayActivityCreationService.creatingInstanceId` : un second clic sur "+"
   * pendant cette fenêtre re-scroller vers la création en cours au lieu d'en
   * démarrer une seconde en parallèle.
   */
  private readonly creatingId = signal<string | null>(null);

  connect(config: LogisticsCreationConfig): void {
    this.config = config;
  }

  /**
   * Point d'entrée unique du "+" flottant sur le sous-onglet Logistique.
   * `initialType` : passé non-'other' par le menu "Ajouter" d'un jour (voir
   * `DayLogisticQuickAddService`) quand le type est déjà connu — dans ce cas
   * la cinématique guidée saute directement l'étape "Type" (déjà répondue).
   */
  startCreation(initialType: LogisticType = 'other'): void {
    const inProgressId = this.creatingId();
    if (inProgressId) {
      this.config.getCards().find((c) => c.logisticId() === inProgressId)
        ?.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    this.createLogistic(initialType, initialType !== 'other');
  }

  private createLogistic(type: LogisticType, skipTypeStep: boolean): void {
    const id = crypto.randomUUID();

    // Pas de date/heure préremplie (voir ROADMAP.md) : reste vide jusqu'à ce
    // que la cinématique guidée (ou l'édition manuelle) la renseigne — même
    // principe que les heures d'une activité.
    const logistic: Logistic = {
      id,
      type,
      title: '',
      files: [],
      links: [],
      booking: { status: BookingStatus.NOT_NEEDED },
    };

    this.tripFacade.createLogistic(this.config.getTripId(), logistic);
    this.creatingId.set(id);

    afterNextRender(() => this.focusNewCardWhenReady(id, skipTypeStep), { injector: this.injector });
  }

  /**
   * Retente sur quelques frames avant d'abandonner silencieusement — même
   * raison que `DayScrollSyncService.focusActivityWhenReady`/
   * `LogisticsListComponent.focusCardWhenReady` : `getCards()`
   * (viewChildren) peut ne pas encore refléter la carte tout juste créée au
   * moment du premier `afterNextRender`, sinon le scroll (et le chaînage
   * guidé) ne se déclenchaient jamais. Libère `creatingId` dès que la carte
   * est trouvée (voir `startCreation`).
   */
  private focusNewCardWhenReady(id: string, skipTypeStep: boolean, attemptsLeft = 15): void {
    const card = this.config.getCards().find((c) => c.logisticId() === id);
    if (!card) {
      if (attemptsLeft <= 0) {
        this.creatingId.set(null);
        return;
      }
      requestAnimationFrame(() => this.focusNewCardWhenReady(id, skipTypeStep, attemptsLeft - 1));
      return;
    }

    this.creatingId.set(null);
    card.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.startGuidedEntry(skipTypeStep);
  }
}
