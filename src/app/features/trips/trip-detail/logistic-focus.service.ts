import { Injectable, signal } from '@angular/core';

export interface LogisticFocusRequest {
  logisticId: string;
  token: number;
}

/**
 * Demande de navigation croisée "va sur le sous-menu Réservations et ouvre
 * cet item en édition" (tap sur une bannière de réservation depuis un jour).
 * Même pattern que `DayActivityFocusService` : `TripDetailComponent` bascule
 * sur l'onglet Général, `GeneralPanelComponent` bascule sur le sous-onglet
 * Réservations, `LogisticsListComponent` ouvre le dialog d'édition puis
 * consomme (`clear`) la requête — trois consommateurs indépendants du même
 * signal `pending`, chacun réagissant à sa propre échelle.
 */
@Injectable()
export class LogisticFocusService {
  private tokenSeq = 0;
  private readonly _pending = signal<LogisticFocusRequest | null>(null);

  readonly pending = this._pending.asReadonly();

  requestFocus(logisticId: string): void {
    this._pending.set({ logisticId, token: ++this.tokenSeq });
  }

  clear(token: number): void {
    if (this._pending()?.token === token) this._pending.set(null);
  }
}
