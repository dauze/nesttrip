import { ChangeDetectionStrategy, Component, Injector, afterNextRender, computed, effect, inject, input, viewChildren } from '@angular/core';
import { PanelComponent } from '@app/shared/components/panel/panel.component';
import { MessageComponent } from '@app/shared/components/message/message.component';
import { TripFacade } from '@app/features/trips/trip-facade.service';
import { LogisticFocusService } from '@app/features/trips/trip-detail/logistic-focus.service';
import { LogisticCardComponent } from './logistic-card/logistic-card.component';
import { LogisticsCreationService } from './logistics-creation.service';
import { NewLogisticDraftComponent } from './new-logistic-draft/new-logistic-draft.component';

/**
 * Sous-menu "Réservations" : liste de `LogisticCardComponent`, triée
 * automatiquement (voir `TripFacade.allLogisticsSorted` — en cours/futures
 * d'abord, passées à la fin, pas de glisser-déposer manuel), mêmes principes
 * que `TripActivitiesComponent` (pool général des activités) — pas de bouton
 * "Ajouter" local, la création passe exclusivement par le "+" flottant unique
 * (voir `GeneralPanelComponent.onFabActivate` -> `triggerCreate()` ci-dessous),
 * jamais de popup : un brouillon inline (`NewLogisticDraftComponent`, même
 * mobile que desktop) crée la réservation dès qu'un titre est saisi, puis se
 * referme sur une carte dépliable, éditable en direct.
 */
@Component({
  selector: 'app-logistics-list',
  standalone: true,
  imports: [PanelComponent, MessageComponent, LogisticCardComponent, NewLogisticDraftComponent],
  templateUrl: './logistics-list.component.html',
  styleUrl: './logistics-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [LogisticsCreationService],
})
export class LogisticsListComponent {
  private readonly tripFacade = inject(TripFacade);
  private readonly logisticFocusService = inject(LogisticFocusService);
  private readonly injector = inject(Injector);
  protected readonly creationService = inject(LogisticsCreationService);

  private readonly logisticCards = viewChildren(LogisticCardComponent);

  readonly tripId = input.required<string>();

  readonly logistics = computed(() => this.tripFacade.allLogisticsSorted(this.tripId()));

  constructor() {
    this.creationService.connect({
      getCards: () => this.logisticCards(),
      getTripId: () => this.tripId(),
    });

    // Demande de navigation croisée (voir LogisticFocusService) : consomme
    // la requête dès que ce composant est monté (sous-onglet déjà basculé par
    // GeneralPanelComponent), déplie la carte ciblée et y scrolle — plus de
    // dialog à ouvrir, la carte est déjà dans la liste.
    effect(() => {
      const pending = this.logisticFocusService.pending();
      if (!pending) return;

      afterNextRender(() => this.focusCardWhenReady(pending.logisticId, pending.token), { injector: this.injector });
    });
  }

  /**
   * Retente sur quelques frames avant d'abandonner silencieusement — même
   * raison que `DayScrollSyncService.focusActivityWhenReady` : ce composant
   * vient parfois d'être monté à l'instant (bascule d'onglet juste avant),
   * donc `logisticCards()` (viewChildren) peut ne pas encore refléter le
   * tout premier rendu au moment du `afterNextRender`. Sans retry, la carte
   * ciblée ne se dépliait/scrollait jamais dans ce cas.
   */
  private focusCardWhenReady(logisticId: string, token: number, attemptsLeft = 15): void {
    const card = this.logisticCards().find((c) => c.logisticId() === logisticId);
    if (!card) {
      if (attemptsLeft <= 0) return;
      requestAnimationFrame(() => this.focusCardWhenReady(logisticId, token, attemptsLeft - 1));
      return;
    }

    this.logisticFocusService.clear(token);
    card.collapsed.set(false);
    card.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /** Point d'entrée unique du "+" flottant, porté par `GeneralPanelComponent` (pas ce composant). */
  triggerCreate(): void {
    this.creationService.startCreation();
  }
}
