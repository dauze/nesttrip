import { NotesType } from '@app/core/enums/notes.type';
import { Point } from './notes.model';
import { mergePointBackward, mergePointForward, newPoint, removePointAt, reorderPoints, splitPointAt, toggleCheckedPoint } from './notes-points.util';

function point(id: string, text: string, checked = false): Point {
  return { id, text, checked };
}

describe('newPoint', () => {
  it('crée un point vide non coché par défaut, avec un id', () => {
    const p = newPoint();
    expect(p.text).toBe('');
    expect(p.checked).toBe(false);
    expect(p.id).toBeTruthy();
  });
});

describe('toggleCheckedPoint', () => {
  it('coché : déplace le point en fin de liste', () => {
    const elements = [point('a', 'A'), point('b', 'B'), point('c', 'C')];
    const result = toggleCheckedPoint(elements, 0);
    expect(result.map((p) => p.id)).toEqual(['b', 'c', 'a']);
    expect(result.find((p) => p.id === 'a')?.checked).toBe(true);
  });

  it('décoché : déplace le point en tête de liste', () => {
    const elements = [point('a', 'A'), point('b', 'B', true), point('c', 'C')];
    const result = toggleCheckedPoint(elements, 1);
    expect(result.map((p) => p.id)).toEqual(['b', 'a', 'c']);
    expect(result.find((p) => p.id === 'b')?.checked).toBe(false);
  });
});

describe('splitPointAt', () => {
  it('scinde le texte à la position du curseur en 2 points', () => {
    const elements = [point('a', 'Bonjour le monde')];
    const result = splitPointAt(elements, 0, 7);
    expect(result.length).toBe(2);
    expect(result[0].text).toBe('Bonjour');
    expect(result[1].text).toBe(' le monde');
  });

  it('insère le nouveau point juste après, préserve les points suivants', () => {
    const elements = [point('a', 'AB'), point('b', 'suivant')];
    const result = splitPointAt(elements, 0, 1);
    expect(result.map((p) => p.text)).toEqual(['A', 'B', 'suivant']);
  });
});

describe('mergePointBackward', () => {
  it('fusionne le point avec le précédent, retire le point courant', () => {
    const elements = [point('a', 'Bonjour '), point('b', 'monde')];
    const { elements: result, mergedText, cursor } = mergePointBackward(elements, 1);
    expect(result.map((p) => p.id)).toEqual(['a']);
    expect(mergedText).toBe('Bonjour monde');
    expect(cursor).toBe('Bonjour '.length);
  });
});

describe('removePointAt', () => {
  it('retire le point à l\'index donné', () => {
    const elements = [point('a', 'A'), point('b', 'B'), point('c', 'C')];
    expect(removePointAt(elements, 1).map((p) => p.id)).toEqual(['a', 'c']);
  });
});

describe('mergePointForward', () => {
  it('fusionne le point suivant dans le courant, retire le suivant', () => {
    const elements = [point('a', 'Bonjour '), point('b', 'monde')];
    const { elements: result, mergedText } = mergePointForward(elements, 0);
    expect(result.map((p) => p.id)).toEqual(['a']);
    expect(mergedText).toBe('Bonjour monde');
    expect(result[0].text).toBe('Bonjour monde');
  });
});

describe('reorderPoints', () => {
  it('type non-TODO : réordonne directement la liste complète', () => {
    const elements = [point('a', 'A'), point('b', 'B'), point('c', 'C')];
    const result = reorderPoints(elements, NotesType.INFO, 0, 2);
    expect(result.map((p) => p.id)).toEqual(['b', 'c', 'a']);
  });

  it('type TODO : réordonne seulement les non-cochés, les cochés restent en fin', () => {
    const elements = [point('a', 'A'), point('b', 'B', true), point('c', 'C'), point('d', 'D')];
    // unchecked = [a, c, d] ; on déplace a (index 0) en position 2 -> [c, d, a]
    const result = reorderPoints(elements, NotesType.TODO, 0, 2);
    expect(result.map((p) => p.id)).toEqual(['c', 'd', 'a', 'b']);
  });
});
