import { Injectable, signal } from '@angular/core';

export interface NotesFocusRequest {
  token: number;
}

/**
 * Demande de navigation croisée "va sur le tab Listes et crée-y une nouvelle
 * note" (entrée "Liste" du menu "Ajouter", voir
 * `TripDetailComponent.addMenuItems`, ROADMAP.md "UX / Interactions"). Même
 * pattern que `LogisticFocusService` : `TripDetailComponent` bascule sur le
 * tab Listes (id technique `'notes'`), `NotesComponent` crée la note
 * (`addItem()`, centre + focus le champ) puis consomme (`clear`) la requête —
 * deux consommateurs indépendants du même signal `pending`, chacun
 * réagissant à sa propre échelle.
 */
@Injectable()
export class NotesFocusService {
  private tokenSeq = 0;
  private readonly _pending = signal<NotesFocusRequest | null>(null);

  readonly pending = this._pending.asReadonly();

  requestCreate(): void {
    this._pending.set({ token: ++this.tokenSeq });
  }

  clear(token: number): void {
    if (this._pending()?.token === token) this._pending.set(null);
  }
}
