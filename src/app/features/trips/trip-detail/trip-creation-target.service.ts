import { Injectable, Signal, signal } from '@angular/core';

export type GeneralCreationSubTab = 'activities' | 'notes';

export interface GeneralCreationTarget {
  activeSubTab: Signal<GeneralCreationSubTab>;
  trigger: () => void;
}

/**
 * Registre du "+" flottant UNIQUE de TripDetailComponent (rendu hors du
 * swiper de jours, en vrai `position: fixed` — voir `.drag-portal-anchor`
 * dans trip-detail.component.scss pour la même raison : un ancêtre
 * `swiper-slide` applique un `transform` permanent, qui casserait un
 * `position:fixed` posé À L'INTÉRIEUR du swiper). Comme le bouton vit HORS
 * de l'arbre des panels, il ne peut pas appeler directement leurs méthodes :
 * chaque panel s'enregistre ici au montage, et se désenregistre au destroy.
 *
 * `general` : un seul enregistrement possible (onglet "Général", singleton —
 * jamais deux instances de `GeneralPanelComponent` simultanément).
 * `day` : plusieurs jours peuvent être montés en même temps (préchargement
 * des jours voisins, voir TripDaySwiperComponent.preloadAround), d'où une Map
 * indexée par dayId — seul le trigger du jour COURANT (`activeDay()`,
 * connu de TripDetailComponent) est jamais appelé.
 *
 * Fourni par `TripDetailComponent` (pas root) : partagé entre le swiper (qui
 * enregistre) et le bouton flottant (qui appelle), tous deux descendants de
 * ce même composant dans l'arbre de vues.
 */
@Injectable()
export class TripCreationTargetService {
  private readonly _general = signal<GeneralCreationTarget | null>(null);
  private readonly dayTriggers = new Map<string, () => void>();

  readonly general = this._general.asReadonly();

  registerGeneral(target: GeneralCreationTarget): () => void {
    this._general.set(target);
    return () => this._general.set(null);
  }

  registerDay(dayId: string, trigger: () => void): () => void {
    this.dayTriggers.set(dayId, trigger);
    return () => {
      if (this.dayTriggers.get(dayId) === trigger) this.dayTriggers.delete(dayId);
    };
  }

  triggerDay(dayId: string): void {
    this.dayTriggers.get(dayId)?.();
  }
}
