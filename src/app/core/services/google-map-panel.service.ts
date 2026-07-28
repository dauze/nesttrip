import { Injectable, signal } from '@angular/core';

// Instance partagée par DayPanelComponent/TripDayMapComponent — fournie au niveau de TripsComponent (voir ses `providers`), pas root : aucun usage en dehors de /trips.
@Injectable()
export class GoogleMapPanelService {
  // 1. Le signal privé qui stocke l'état (écriture interne uniquement)
  private readonly _isCollapsed = signal<boolean>(false);

  // 2. Le signal public en lecture seule (récupération de la donnée)
  readonly isCollapsed = this._isCollapsed.asReadonly();

  /**
   * Met à jour l'état de collapse avec une valeur précise
   */
  setCollapse(value: boolean): void {
    this._isCollapsed.set(value);
  }

  /**
   * Alterne l'état actuel (true <-> false)
   */
  toggleCollapse(): void {
    this._isCollapsed.update(currentState => !currentState);
  }

  private editLockCount = 0;
  private collapseBeforeEditLock = false;

  /**
   * Verrou réentrant (compteur, pas un booléen) : plusieurs `ActivityCardComponent`
   * peuvent être en édition simultanément dans un même jour (chaque carte
   * gère son propre `collapsed`, voir ROADMAP.md), donc la fermeture forcée
   * de la carte doit tenir compte de TOUTES les éditions en cours, pas
   * seulement la dernière. Même principe que SwiperLockService. Snapshot
   * pris uniquement à l'ouverture du TOUT premier verrou, restauré à la
   * fermeture du DERNIER — les verrous intermédiaires n'écrivent/ne lisent
   * rien d'autre que le compteur.
   */
  beginEditLock(): void {
    if (this.editLockCount === 0) this.collapseBeforeEditLock = this._isCollapsed();
    this.editLockCount++;
    this.setCollapse(true);
  }

  endEditLock(): void {
    this.editLockCount = Math.max(0, this.editLockCount - 1);
    if (this.editLockCount === 0) this.setCollapse(this.collapseBeforeEditLock);
  }
}