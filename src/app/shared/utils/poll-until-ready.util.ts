/**
 * Retente `find()` sur quelques frames (`requestAnimationFrame`) avant d'abandonner
 * silencieusement, plutôt qu'un flag/timeout arbitraire — utile juste après le montage d'un
 * composant, quand la cible cherchée (élément DOM, entrée d'une liste dérivée d'un signal) peut
 * ne pas encore être disponible au premier rendu. Voir `NotesComponent.focusItemWhenReady`/
 * `LogisticsListComponent.focusCardWhenReady`, les deux usages d'origine.
 */
export function pollUntilReady<T>(find: () => T | null | undefined, onFound: (value: T) => void, attemptsLeft = 15): void {
  const value = find();
  if (value != null) {
    onFound(value);
    return;
  }
  if (attemptsLeft <= 0) return;
  requestAnimationFrame(() => pollUntilReady(find, onFound, attemptsLeft - 1));
}
