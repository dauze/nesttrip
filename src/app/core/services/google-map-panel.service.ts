import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root' // Permet de partager la même instance dans toute l'application
})
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
}