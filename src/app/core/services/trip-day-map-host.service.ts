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
/** Contexte actuellement propriétaire de la carte partagée — voir `TripDayMapComponent.collapsed` ('day' suit `GoogleMapPanelService`, 'general' n'est jamais repliable, voir ROADMAP.md "Carte"). */
export type TripDayMapOwner = 'day' | 'general';

@Injectable()
export class TripDayMapHostService {
  private readonly mapComponent = signal<TripDayMapComponent | null>(null);
  readonly activeMap = this.mapComponent.asReadonly();

  private readonly _currentOwner = signal<TripDayMapOwner | null>(null);
  readonly currentOwner = this._currentOwner.asReadonly();

  /**
   * Conteneur `position:fixed` (posé par `TripDaySwiperComponent`, hors du
   * `swiper-container`) où la carte partagée est déplacée en contexte 'day'
   * sur layout empilé (mobile/tablette) — ROADMAP.md "### UI" : la carte doit
   * réellement sortir du scroll du jour, pas seulement y être "sticky". En
   * layout scindé (desktop), `DayPanelComponent` continue de cibler son
   * propre `.sticky-map` local (carte en colonne, pas de notion de "sortir du
   * scroll" là-bas) — ce conteneur reste alors simplement vide.
   */
  private readonly _dayFixedContainer = signal<HTMLElement | null>(null);
  readonly dayFixedContainer = this._dayFixedContainer.asReadonly();

  /** Hauteur réelle courante du conteneur ci-dessus (mesurée par `TripDaySwiperComponent` via ResizeObserver) — 0 quand vide (layout scindé, ou aucun jour actif). Consommée par `DayPanelComponent`/`day-panel.component.scss` pour réserver l'espace équivalent en haut du contenu scrollable. */
  private readonly _dayFixedContainerHeight = signal(0);
  readonly dayFixedContainerHeight = this._dayFixedContainerHeight.asReadonly();

  /** Appelé une seule fois par TripDaySwiperComponent, propriétaire de l'instance. */
  register(component: TripDayMapComponent): void {
    this.mapComponent.set(component);
  }

  registerDayFixedContainer(el: HTMLElement | null): void {
    this._dayFixedContainer.set(el);
  }

  setDayFixedContainerHeight(height: number): void {
    this._dayFixedContainerHeight.set(height);
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

  /**
   * Reparque la carte dans un conteneur neutre (invisible, `.map-anchor`)
   * quand l'onglet actif n'en réclame la propriété ni en 'day' ni en
   * 'general' (Activités/Logistique/Listes, qui n'affichent aucune carte) —
   * sans ça, `.day-fixed-map` (mobile, hors du swiper) gardait le noeud DOM
   * de la carte déplacé par le dernier jour visité, donc restait visible
   * (hauteur non nulle) par-dessus ces onglets au lieu de se fermer. Ne
   * touche PAS `currentOwner` : rien ne le lit tant que la carte est
   * effectivement masquée dans l'ancre.
   */
  park(anchor: HTMLElement): void {
    const map = this.mapComponent();
    if (!map) return;

    const node = map.elementRef.nativeElement as HTMLElement;
    if (node.parentElement === anchor) return;

    anchor.appendChild(node);
  }
}