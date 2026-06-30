import { effect, untracked, Signal } from '@angular/core';

/**
 * Exécute `apply` une seule fois, dès que `source` retourne une valeur définie.
 * Remplace le pattern ngOnInit + flag pour initialiser un état local (ex: patcher
 * un formulaire) à partir d'une donnée résolue de façon asynchrone, sans
 * re-déclencher à chaque changement ultérieur — cohérent avec l'UI optimiste :
 * on ne veut jamais écraser une saisie en cours suite à un changement distant.
 *
 * À appeler depuis un contexte d'injection (constructeur de composant).
 */
export function runOnceReady<T>(
  source: Signal<T | null | undefined>,
  apply: (value: T) => void,
): void {
  let done = false;
  effect(() => {
    const value = source();
    if (value != null && !done) {
      done = true;
      untracked(() => apply(value));
    }
  });
}