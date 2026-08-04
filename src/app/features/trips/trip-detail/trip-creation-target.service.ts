import { Injectable, signal } from '@angular/core';

interface PendingCreate {
  id: string;
  token: number;
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
 * Un seul déclencheur par id (jour ISO, ou `'activities'` pour le pool
 * d'activités générales — seul tab de premier niveau parmi Activités/
 * Logistique/Listes à avoir un bouton de création dédié, comme un jour) :
 * plusieurs jours peuvent être montés en même temps (préchargement des jours
 * voisins, voir TripDaySwiperComponent.preloadAround), d'où une Map indexée
 * par id — seul le trigger de l'onglet COURANT (`activeDay()`, connu de
 * TripDetailComponent) est jamais appelé.
 *
 * Fourni par `TripDetailComponent` (pas root) : partagé entre le swiper (qui
 * enregistre) et le bouton flottant (qui appelle), tous deux descendants de
 * ce même composant dans l'arbre de vues.
 */
@Injectable()
export class TripCreationTargetService {
  private readonly triggers = new Map<string, () => void>();

  register(id: string, trigger: () => void): () => void {
    this.triggers.set(id, trigger);
    return () => {
      if (this.triggers.get(id) === trigger) this.triggers.delete(id);
    };
  }

  trigger(id: string): void {
    this.triggers.get(id)?.();
  }

  // ── Création différée jusqu'au montage (voir addMenuItems, entrée "Activité"
  // depuis Logistique/Listes) ── même schéma que NotesFocusService/LogisticFocusService :
  // un "pending" posé par l'appelant, consommé par un effect() dans le composant
  // cible dès qu'il est monté — nécessaire car naviguer vers l'onglet Activités
  // (changement de slide du swiper) et le montage réel du composant ne sont pas
  // synchrones.
  private readonly _pendingCreate = signal<PendingCreate | null>(null);
  private createTokenSeq = 0;
  readonly pendingCreate = this._pendingCreate.asReadonly();

  requestCreateOnMount(id: string): void {
    this._pendingCreate.set({ id, token: ++this.createTokenSeq });
  }

  clearPendingCreate(token: number): void {
    if (this._pendingCreate()?.token === token) this._pendingCreate.set(null);
  }

  // ── Évitement de bord du "+" flottant (voir ROADMAP.md "UX / Interactions") ──
  // Alimenté par `FabBottomProximityDirective` sur l'écran actif (jour, pool
  // d'activités, logistique) : `true` quand ce "+" cache le bas d'une carte
  // et qu'on ne peut plus scroller pour la voir. Un seul écran actif à la
  // fois y écrit (les jours préchargés non actifs remontent toujours
  // `false`), donc dernier appel gagnant sans conflit.
  private readonly _avoidEdge = signal(false);
  readonly avoidEdge = this._avoidEdge.asReadonly();

  setAvoidEdge(active: boolean): void {
    this._avoidEdge.set(active);
  }

  // ── Recherche en cours du tab Logistique (voir ROADMAP.md "UX / Interactions",
  // "préremplissage/vidage") ── le menu "Type" du "+" flottant vit dans
  // `TripDetailComponent` (hors de `LogisticsListComponent`, voir la doc de
  // classe), il n'a donc pas d'accès direct à son `searchTerm` local — même
  // schéma que `avoidEdge` : alimenté par l'écran actif, lu par le "+".
  private readonly _logisticsSearchTerm = signal('');
  readonly logisticsSearchTerm = this._logisticsSearchTerm.asReadonly();

  setLogisticsSearchTerm(term: string): void {
    this._logisticsSearchTerm.set(term);
  }
}
