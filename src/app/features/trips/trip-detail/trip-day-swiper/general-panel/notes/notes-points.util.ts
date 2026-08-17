import { moveItemInArray } from '@angular/cdk/drag-drop';
import { NotesType } from '@app/core/enums/notes.type';
import { Point } from './notes.model';

/**
 * Manipulations pures de `Point[]` extraites de `NotesComponent` — mini-éditeur outliner
 * (fusion/scission de lignes, navigation) qui mélangeait jusqu'ici cette logique avec la lecture/
 * écriture DOM du curseur (`el.selectionStart`/`setSelectionRange`, restée dans le composant,
 * seule à savoir QUEL point/curseur est concerné par un événement clavier donné).
 */

export function newPoint(text = '', checked = false): Point {
  return { id: crypto.randomUUID(), text, checked };
}

/** Bascule l'état coché du point `index` et le déplace en fin (coché) ou en tête (décoché) de la liste — voir `NotesComponent.toggleCheck`. */
export function toggleCheckedPoint(elements: Point[], index: number): Point[] {
  const point = elements[index];
  const updated = { ...point, checked: !point.checked };
  const rest = elements.filter((_, i) => i !== index);
  return updated.checked ? [...rest, updated] : [updated, ...rest];
}

/** Scinde le point `index` en 2 à la position `cursor` — le texte après le curseur devient un nouveau point juste après. Voir `NotesComponent.onEnterRow`. */
export function splitPointAt(elements: Point[], index: number, cursor: number): Point[] {
  const text = elements[index].text;
  const before = text.substring(0, cursor);
  const after = text.substring(cursor);
  const next = [...elements];
  next[index] = { ...next[index], text: before };
  next.splice(index + 1, 0, newPoint(after, elements[index].checked));
  return next;
}

/** Fusionne le point `index` dans le précédent (Backspace en tête de ligne) — voir `NotesComponent.onBackspaceRow`. */
export function mergePointBackward(elements: Point[], index: number): { elements: Point[]; mergedText: string; cursor: number } {
  const upper = elements[index - 1].text;
  const mergedText = upper + elements[index].text;
  const next = elements
    .map((p, i) => (i === index - 1 ? { ...p, text: mergedText } : p))
    .filter((_, i) => i !== index);
  return { elements: next, mergedText, cursor: upper.length };
}

/** Supprime le point `index` (Delete sur un point vide, au moins 2 points restants) — voir `NotesComponent.onDeleteRow`. */
export function removePointAt(elements: Point[], index: number): Point[] {
  return elements.filter((_, i) => i !== index);
}

/** Fusionne le point `index + 1` dans le point `index` (Delete en fin de ligne) — voir `NotesComponent.onDeleteRow`. */
export function mergePointForward(elements: Point[], index: number): { elements: Point[]; mergedText: string } {
  const mergedText = elements[index].text + elements[index + 1].text;
  const next = elements
    .map((p, i) => (i === index ? { ...p, text: mergedText } : p))
    .filter((_, i) => i !== index + 1);
  return { elements: next, mergedText };
}

/** Réordonne les points d'une liste — type TODO : les cochés restent toujours en fin de liste. Voir `NotesComponent.onDropPoint`. */
export function reorderPoints(elements: Point[], type: NotesType, previousIndex: number, currentIndex: number): Point[] {
  if (type !== NotesType.TODO) {
    const next = [...elements];
    moveItemInArray(next, previousIndex, currentIndex);
    return next;
  }

  // Les indices du drag event sont relatifs aux unchecked uniquement.
  const unchecked = elements.filter((p) => !p.checked);
  const checked = elements.filter((p) => p.checked);
  moveItemInArray(unchecked, previousIndex, currentIndex);
  return [...unchecked, ...checked];
}
