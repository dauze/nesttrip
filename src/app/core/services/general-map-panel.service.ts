import { Injectable, computed, inject, linkedSignal } from '@angular/core';
import { ViewportService } from '@app/core/services/viewport.service';

/**
 * Équivalent de `GoogleMapPanelService` pour la carte du pool d'activités
 * (onglet Général → Activités), avec un état de collapse INDÉPENDANT de la
 * vue jour (voir `TripDayMapHostService.currentOwner`, consommé par
 * `TripDayMapComponent.collapsed`) : le pool doit être replié par défaut sur
 * mobile et déplié par défaut sur desktop, deux valeurs par défaut
 * différentes que la vue jour (toujours dépliée) ne peut pas partager avec un
 * seul booléen (voir ROADMAP.md, "Carte"/"UI Desktop").
 *
 * `linkedSignal` sur `!viewport.isSplitLayout()` : se réaligne sur le
 * nouveau défaut à chaque franchissement du seuil desktop/mobile, tout en
 * restant modifiable manuellement (toggle du panel) entre deux franchissements.
 *
 * Fournie au niveau de TripsComponent (voir ses `providers`), comme
 * `GoogleMapPanelService` : aucun usage en dehors de /trips.
 */
@Injectable()
export class GeneralMapPanelService {
  private readonly viewport = inject(ViewportService);
  private readonly defaultCollapsed = computed(() => !this.viewport.isSplitLayout());
  private readonly _isCollapsed = linkedSignal(() => this.defaultCollapsed());

  readonly isCollapsed = this._isCollapsed.asReadonly();

  setCollapse(value: boolean): void {
    this._isCollapsed.set(value);
  }

  toggleCollapse(): void {
    this._isCollapsed.update(current => !current);
  }
}
