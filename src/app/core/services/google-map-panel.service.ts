import { effect, inject, Injectable, signal } from '@angular/core';
import { UserProfileService } from './user-profile.service';

// Instance partagée par DayPanelComponent/TripDayMapComponent — fournie au niveau de TripsComponent (voir ses `providers`), pas root : aucun usage en dehors de /trips.
@Injectable()
export class GoogleMapPanelService {
  private readonly userProfileService = inject(UserProfileService);

  // 1. Le signal privé qui stocke l'état (écriture interne uniquement)
  private readonly _isCollapsed = signal<boolean>(false);

  // 2. Le signal public en lecture seule (récupération de la donnée)
  readonly isCollapsed = this._isCollapsed.asReadonly();

  /**
   * Préférence utilisateur (`users/{uid}.mapCollapsedByDefault`, ROADMAP.md
   * "### UI") : seed l'état local UNE SEULE fois dès qu'elle devient connue
   * (le profil est `undefined` avant le premier chargement Firestore) —
   * n'écrase jamais une bascule locale déjà faite par l'utilisateur dans
   * cette session (voir le flag `seeded`, un `effect` réagirait sinon à
   * chaque changement de `mapCollapsedByDefault`, y compris ceux causés par
   * `setCollapse` lui-même via l'écriture ci-dessous, créant un aller-retour
   * inutile — pas un bug fonctionnel ici, mais sans intérêt).
   */
  private seeded = false;

  constructor() {
    effect(() => {
      const preference = this.userProfileService.mapCollapsedByDefault();
      if (this.seeded || preference === undefined) return;
      this.seeded = true;
      this._isCollapsed.set(preference);
    });
  }

  /**
   * Met à jour l'état de collapse avec une valeur précise
   */
  setCollapse(value: boolean): void {
    this._isCollapsed.set(value);
    this.seeded = true;
    this.userProfileService.setMapCollapsedByDefault(value);
  }

  /**
   * Alterne l'état actuel (true <-> false)
   */
  toggleCollapse(): void {
    this.setCollapse(!this._isCollapsed());
  }
}