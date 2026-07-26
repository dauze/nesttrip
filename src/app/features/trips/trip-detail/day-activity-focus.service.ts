import { Injectable, signal } from '@angular/core';

export interface DayFocusRequest {
  dayId: string;
  instanceId?: string;
  token: number;
}

/**
 * Registre de demandes "va sur ce jour (+ scroll vers cette instance si
 * précisée)", pour un composant qui n'a pas de lien direct avec
 * `TripDetailComponent` (propriétaire de `activeDay`) ni avec le
 * `DayPanelComponent` cible (voir onglet Activités général, qui affiche des
 * dates de jours sur lesquels naviguer). Même pattern que
 * `TripCreationTargetService` : fourni par `TripDetailComponent` (pas root),
 * partagé entre l'émetteur (qui appelle `requestFocus`) et `DayPanelComponent`
 * (qui consomme via `pending`/`clear` une fois devenu le jour actif).
 *
 * `token` permet de distinguer deux requêtes successives vers le MÊME jour
 * (ex. deux clics sur deux dates du même jour) : sans lui, la nouvelle
 * requête écraserait la précédente avec un objet différent mais
 * `clear(previousToken)` resterait valide et effacerait la nouvelle par erreur.
 */
@Injectable()
export class DayActivityFocusService {
  private tokenSeq = 0;
  private readonly _pending = signal<DayFocusRequest | null>(null);

  readonly pending = this._pending.asReadonly();

  requestFocus(dayId: string, instanceId?: string): void {
    this._pending.set({ dayId, instanceId, token: ++this.tokenSeq });
  }

  clear(token: number): void {
    if (this._pending()?.token === token) this._pending.set(null);
  }
}
