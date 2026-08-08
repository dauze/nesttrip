import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * Pont entre le menu réglages (roue crantée, `TripsComponent`, ancêtre commun
 * à tout /trips) et des déclencheurs qui vivent plus bas dans l'arbre, hors de
 * portée directe du `viewChild` sur `app-menu` (ex. le header voyage épuré,
 * `TripHeaderComponent`, monté uniquement dans l'onglet Résumé — voir CLAUDE.md
 * "services transverses"). `requestOpen` : clic sur le header voyage, doit
 * ouvrir le même menu que la roue crantée. `requestClose` : action de la
 * section "Voyage" qui invalide son propre contexte (suppression du voyage),
 * pour ne pas laisser le menu ouvert sur des données qui viennent de disparaître.
 */
@Injectable()
export class AppSettingsMenuService {
  private readonly _openRequests = new Subject<void>();
  private readonly _closeRequests = new Subject<void>();

  readonly openRequests$ = this._openRequests.asObservable();
  readonly closeRequests$ = this._closeRequests.asObservable();

  requestOpen(): void {
    this._openRequests.next();
  }

  requestClose(): void {
    this._closeRequests.next();
  }
}
