import { Injectable, signal } from '@angular/core';

export interface ReservationFocusRequest {
  reservationId: string;
  token: number;
}

/**
 * Demande de navigation croisée "va sur le sous-menu Réservations et ouvre
 * cet item en édition" (tap sur une bannière de réservation depuis un jour).
 * Même pattern que `DayActivityFocusService` : `TripDetailComponent` bascule
 * sur l'onglet Général, `GeneralPanelComponent` bascule sur le sous-onglet
 * Réservations, `ReservationsListComponent` ouvre le dialog d'édition puis
 * consomme (`clear`) la requête — trois consommateurs indépendants du même
 * signal `pending`, chacun réagissant à sa propre échelle.
 */
@Injectable()
export class ReservationFocusService {
  private tokenSeq = 0;
  private readonly _pending = signal<ReservationFocusRequest | null>(null);

  readonly pending = this._pending.asReadonly();

  requestFocus(reservationId: string): void {
    this._pending.set({ reservationId, token: ++this.tokenSeq });
  }

  clear(token: number): void {
    if (this._pending()?.token === token) this._pending.set(null);
  }
}
