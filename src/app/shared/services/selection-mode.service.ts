import { Injectable, computed, signal } from '@angular/core';

/**
 * Toute entité sélectionnable dans le mode suppression groupée transverse
 * (voir SelectableDirective/SelectionActionBarComponent). `dayId` n'a de sens
 * que pour `dayActivityInstance` (nécessaire à `TripFacade.removeDayActivityInstance`).
 */
export type SelectableItemRef =
  | { kind: 'trip'; id: string }
  | { kind: 'poolActivity'; id: string }
  | { kind: 'dayActivityInstance'; id: string; dayId: Date }
  | { kind: 'reservation'; id: string }
  | { kind: 'noteItem'; id: string };

export function selectableItemKey(ref: SelectableItemRef): string {
  return `${ref.kind}:${ref.id}`;
}

/**
 * Mode sélection multiple transverse : mobile (long-press puis tap, voir
 * SelectableDirective) et PC (checkbox toujours visible) partagent exactement
 * le même état. Volontairement PAS `providedIn: 'root'` : fourni via
 * `providers:` par le composant racine de chaque écran (TripDetailComponent,
 * AccueilTripComponent), comme TripChromeService/DayActivityFocusService —
 * une instance par arbre, jamais partagée entre deux écrans différents.
 *
 * Une seule instance pour tout un trip (Général + tous les jours du swiper)
 * permet de sélectionner en même temps des notes, des activités générales et
 * des activités d'un jour, puis de tout supprimer en une seule confirmation.
 */
@Injectable()
export class SelectionModeService {
  private readonly _active = signal(false);
  private readonly _selected = signal(new Map<string, SelectableItemRef>());

  readonly active = this._active.asReadonly();
  readonly selectedCount = computed(() => this._selected().size);

  isSelectedKey(key: string): boolean {
    return this._selected().has(key);
  }

  /**
   * (Dé)sélectionne. Passe automatiquement le mode à actif dès le premier
   * ajout, et à inactif dès que la sélection repasse à zéro — c'est ce qui
   * fait que "tout désélectionner" équivaut à "Annuler" sans code dédié.
   */
  toggle(ref: SelectableItemRef): void {
    const key = selectableItemKey(ref);
    const current = new Map(this._selected());
    if (current.has(key)) {
      current.delete(key);
    } else {
      current.set(key, ref);
    }
    this._selected.set(current);
    this._active.set(current.size > 0);
  }

  /** Bouton "Annuler" du drawer : quitte le mode et vide la sélection. */
  cancel(): void {
    this._active.set(false);
    this._selected.set(new Map());
  }

  values(): SelectableItemRef[] {
    return [...this._selected().values()];
  }
}
