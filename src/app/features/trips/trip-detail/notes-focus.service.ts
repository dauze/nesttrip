import { Injectable, signal } from '@angular/core';

export interface NotesFocusRequest {
  token: number;
  /** Item existant à mettre en évidence/scroller (voir `requestFocus`) — absent pour une simple création (`requestCreate`). */
  itemId?: string;
}

/**
 * Demande de navigation croisée "va sur le tab Listes" (voir ROADMAP.md "UX
 * / Interactions"), deux usages : `requestCreate` (entrée "Liste" du menu
 * "Ajouter", voir `TripDetailComponent.addMenuItems`) crée une nouvelle
 * note ; `requestFocus` (chip "liste liée" depuis une activité, voir
 * `ActivityFormComponent`) scrolle vers un item EXISTANT sans en créer.
 * Même pattern que `LogisticFocusService` : `TripDetailComponent` bascule
 * sur le tab Listes (id technique `'notes'`), `NotesComponent` traite la
 * requête (crée ou scrolle selon `itemId`) puis consomme (`clear`) — deux
 * consommateurs indépendants du même signal `pending`, chacun réagissant à
 * sa propre échelle.
 */
@Injectable()
export class NotesFocusService {
  private tokenSeq = 0;
  private readonly _pending = signal<NotesFocusRequest | null>(null);

  readonly pending = this._pending.asReadonly();

  requestCreate(): void {
    this._pending.set({ token: ++this.tokenSeq });
  }

  requestFocus(itemId: string): void {
    this._pending.set({ itemId, token: ++this.tokenSeq });
  }

  clear(token: number): void {
    if (this._pending()?.token === token) this._pending.set(null);
  }
}
