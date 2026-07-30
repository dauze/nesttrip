import { Injectable, signal } from '@angular/core';

export interface LogisticFocusRequest {
  logisticId: string;
  token: number;
  /** Créé depuis le menu "Ajouter" d'un jour (voir `DayLogisticQuickAddService`), type déjà connu : `LogisticsListComponent` enchaîne sur la cinématique guidée (sans réétape "Type") une fois la carte trouvée, plutôt que se contenter de la déplier/scroller. */
  startGuided?: boolean;
}

/**
 * Demande de navigation croisée "va sur le sous-menu Logistique et ouvre cet
 * item en édition" (tap sur une bannière depuis un jour, OU création depuis
 * le menu "Ajouter" d'un jour). Même pattern que `DayActivityFocusService` :
 * `TripDetailComponent` bascule sur l'onglet Général, `GeneralPanelComponent`
 * bascule sur le sous-onglet Logistique, `LogisticsListComponent` déplie/
 * scrolle (et enchaîne la cinématique guidée si `startGuided`) puis consomme
 * (`clear`) la requête — trois consommateurs indépendants du même signal
 * `pending`, chacun réagissant à sa propre échelle.
 */
@Injectable()
export class LogisticFocusService {
  private tokenSeq = 0;
  private readonly _pending = signal<LogisticFocusRequest | null>(null);

  readonly pending = this._pending.asReadonly();

  requestFocus(logisticId: string, startGuided = false): void {
    this._pending.set({ logisticId, token: ++this.tokenSeq, startGuided });
  }

  clear(token: number): void {
    if (this._pending()?.token === token) this._pending.set(null);
  }
}
