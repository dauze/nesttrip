import { Injectable, signal } from '@angular/core';
import { TripDayMapComponent } from '@app/features/trips/trip-detail/trip-day-swiper/day-panel/trip-day-map/trip-day-map.component';

/**
 * Possède la SEULE instance de TripDayMapComponent pour toute la durée de vie
 * d'un trip. Contrairement à un ComponentPortal (qui détruit puis recrée le
 * composant à chaque changement d'outlet), ce service déplace le vrai noeud
 * DOM de la carte d'un day-panel à l'autre via appendChild natif : le
 * ComponentRef, son état Angular et l'instance google.maps.Map sous-jacente
 * ne sont jamais détruits.
 */
/** Contexte actuellement propriétaire de la carte partagée — voir `TripDayMapComponent.collapsed`, qui choisit `GoogleMapPanelService` ou `GeneralMapPanelService` selon cette valeur (fold state indépendant par contexte, voir ROADMAP.md "Carte"). */
export type TripDayMapOwner = 'day' | 'general';

@Injectable()
export class TripDayMapHostService {
  private readonly mapComponent = signal<TripDayMapComponent | null>(null);
  readonly activeMap = this.mapComponent.asReadonly();

  private readonly _currentOwner = signal<TripDayMapOwner | null>(null);
  readonly currentOwner = this._currentOwner.asReadonly();

  /** Appelé une seule fois par TripDaySwiperComponent, propriétaire de l'instance. */
  register(component: TripDayMapComponent): void {
    this.mapComponent.set(component);
  }

  /**
   * Déplace la carte dans le conteneur fourni si elle n'y est pas déjà.
   * Déclenche un resize Google Maps après déplacement, car l'API ne
   * recalcule pas sa géométrie automatiquement après un changement de parent DOM.
   */
  moveTo(container: HTMLElement, owner: TripDayMapOwner): void {
    // Posé AVANT le early-return ci-dessous : un jour qui re-réclame la carte
    // sur un container déjà correct (aucun déplacement DOM nécessaire) doit
    // quand même remettre `currentOwner` à jour si le dernier propriétaire
    // était le pool général.
    this._currentOwner.set(owner);

    const map = this.mapComponent();
    if (!map) return;

    const node = map.elementRef.nativeElement as HTMLElement;
    if (node.parentElement === container) return;

    container.appendChild(node);

    const googleMap = map.googleMap;
    if (googleMap) {
      // Un frame de battement le temps que le layout du nouveau parent se stabilise
      requestAnimationFrame(() => google.maps.event.trigger(googleMap, 'resize'));
    }
  }
}