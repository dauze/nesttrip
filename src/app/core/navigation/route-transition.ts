import { ActivatedRouteSnapshot } from '@angular/router';
import type { ViewTransitionInfo } from '@angular/router';

const FORWARD_CLASS = 'nav-forward';
const BACK_CLASS = 'nav-back';

/**
 * Profondeur "réelle" de l'URL pour une snapshot donnée : nombre total de
 * segments d'URL consommés depuis la racine. Contrairement à `pathFromRoot.length`,
 * ceci ignore les routes de configuration à chemin vide (ex: la route '' de
 * l'écran d'accueil), donc ça reflète bien à quel point on est "enfoncé" dans
 * la navigation plutôt que dans l'arbre de configuration des routes.
 */
function getUrlDepth(snapshot: ActivatedRouteSnapshot): number {
  let node: ActivatedRouteSnapshot | null = snapshot.root;
  let depth = 0;
  while (node) {
    depth += node.url.length;
    node = node.firstChild;
  }
  return depth;
}

/**
 * Callback pour `withViewTransitions({ onViewTransitionCreated })`.
 *
 * Détermine si on navigue "vers l'avant" (on s'enfonce dans l'arborescence,
 * ex: accueil -> détail d'un trip) ou "vers l'arrière" (on remonte, ex:
 * détail -> accueil), et pose une classe sur <html> le temps de la transition
 * pour que le CSS puisse animer dans le bon sens. Fonctionne de la même façon
 * pour une navigation "imperative" (clic) que pour le bouton précédent du
 * navigateur (popstate), car les deux passent par le même événement Router.
 */
export function onViewTransitionCreated({ transition, from, to }: ViewTransitionInfo): void {
  const root = document.documentElement;
  root.classList.remove(FORWARD_CLASS, BACK_CLASS);

  const fromDepth = getUrlDepth(from);
  const toDepth = getUrlDepth(to);

  if (toDepth > fromDepth) {
    root.classList.add(FORWARD_CLASS);
  } else if (toDepth < fromDepth) {
    root.classList.add(BACK_CLASS);
  }

  transition.finished.finally(() => {
    root.classList.remove(FORWARD_CLASS, BACK_CLASS);
  });
}