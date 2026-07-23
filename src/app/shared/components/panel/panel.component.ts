import { Component, ElementRef, input, model, output, signal, viewChild } from '@angular/core';

export interface PanelToggleEvent {
  collapsed: boolean;
}

/**
 * Remplacement maison de `p-panel` (Phase 5 de la sortie de PrimeNG, voir
 * PRIMENG_MIGRATION.md). Le composant le plus réutilisé du projet (8
 * fichiers) : header string (`header`) OU projeté (`[panelHeader]`, header
 * entièrement custom avec ses propres boutons/poignée de drag — jamais les
 * deux à la fois côté appelant), bouton de bascule toujours ajouté APRÈS le
 * contenu de header (même position que PrimeNG, qui l'ajoutait dans sa
 * propre `.p-panel-header-actions`).
 *
 * Animation du contenu : `max-height` mesuré en JS (`scrollHeight`), pas le
 * hack CSS `grid-template-rows: 1fr/0fr` (abandonné — cassait la hauteur de
 * repli avec du contenu complexe, et surtout ne réagissait pas correctement
 * quand du contenu était ajouté APRÈS coup dans un panel déjà déplié, ex.
 * les données Google chargées de façon asynchrone dans
 * activity-google-info : le panel restait figé à l'ancienne hauteur tant
 * qu'on ne le repliait/dépliait pas une seconde fois). `maxHeightPx` repasse
 * à `null` (= `max-height: none`, aucun plafond) une fois la transition de
 * dépli terminée, justement pour que ce genre d'ajout ultérieur ne soit
 * jamais rogné.
 *
 * `beforeToggle` réplique `onBeforeToggle` : émis avec l'état COURANT (celui
 * d'AVANT la bascule, pas la cible) — contre-intuitif vu le nom, mais c'est
 * bien ce que lisent activity-google-info/activity-gallery pour lazy-loader
 * leur contenu à la première expansion (`if (!event.collapsed) return;` ne
 * se comporte comme "charge à l'ouverture" QUE si `collapsed` décrit l'état
 * avant bascule — testé/corrigé empiriquement : avec l'état cible, le
 * chargement se déclenchait à la fermeture, pas à l'ouverture).
 * `afterToggle`, lui, émet bien l'état CIBLE (celui que le panel a
 * effectivement pris).
 *
 * `instant` (voir ActivityCardComponent.collapseInstantly) coupe la
 * transition CSS pour un seul repli forcé (pendant un drag), sans quoi un
 * repli déclenché par code pourrait être capturé à mi-animation. Comme
 * `collapsed`/`instant` peuvent aussi changer de l'EXTÉRIEUR (binding
 * `[(collapsed)]`/`[collapsed]`, pas seulement un clic sur le bouton de CE
 * composant — voir `ActivityCardComponent.collapseInstantly`/
 * `openAndScroll`), l'état "au repos" (0 / mesuré / aucun plafond) est
 * entièrement piloté par binding de template (synchrone avec la détection
 * de changements, y compris `detectChanges()` manuel) ; seule l'ANIMATION
 * du clic sur le bouton de bascule passe par la mesure JS dans `toggle()`.
 */
@Component({
  selector: 'app-panel',
  standalone: true,
  templateUrl: './panel.component.html',
  styleUrl: './panel.component.scss',
  host: {
    class: 'app-panel',
  },
})
export class PanelComponent {
  readonly header = input<string>('');
  readonly toggleable = input(false);
  readonly collapsed = model(false);
  readonly instant = input(false);

  readonly beforeToggle = output<PanelToggleEvent>();
  readonly afterToggle = output<PanelToggleEvent>();

  private readonly contentRef = viewChild<ElementRef<HTMLElement>>('content');

  /** Plafond figé le temps d'une transition déclenchée par `toggle()` ; `null` = pas de plafond (état au repos une fois dépliée). */
  protected readonly maxHeightPx = signal<number | null>(null);

  protected toggle(): void {
    if (!this.toggleable()) return;
    const current = this.collapsed();
    const next = !current;
    // État COURANT (avant bascule), pas la cible — voir la doc de la classe.
    this.beforeToggle.emit({ collapsed: current });

    const el = this.contentRef()?.nativeElement;
    if (!el || this.instant()) {
      this.collapsed.set(next);
      this.afterToggle.emit({ collapsed: next });
      return;
    }

    // Attend une frame avant de mesurer/animer : `beforeToggle` peut
    // déclencher côté appelant un effet de bord asynchrone (ex.
    // activity-google-info démarre le chargement des données Google au
    // premier dépli, via un `toObservable`/`effect` interne) dont la
    // détection de changements ne s'exécute JAMAIS en synchrone avec ce
    // `set()` — mesurer immédiatement capturerait donc l'état d'AVANT ce
    // contenu (le spinner de chargement, par exemple) et le clipperait.
    // Un seul rAF suffit : les microtâches (dont le flush de cet effect)
    // se vident forcément avant la frame suivante.
    requestAnimationFrame(() => this.animate(el, next));
  }

  private animate(el: HTMLElement, next: boolean): void {
    // Fige la hauteur RÉELLE actuelle avant de basculer : `max-height` ne
    // peut pas s'animer depuis/vers `none` (valeur non interpolable), il
    // faut un point de départ chiffré. `scrollHeight` reste exact même
    // repliée (overflow:hidden n'affecte pas cette mesure).
    this.maxHeightPx.set(el.scrollHeight);

    if (next) {
      // Repli : laisse la valeur figée ci-dessus se peindre une frame
      // (sinon la transition démarrerait depuis `none`, donc sans transition
      // visible), PUIS bascule vers 0 — c'est CE second changement qui s'anime.
      requestAnimationFrame(() => this.collapsed.set(next));
    } else {
      this.collapsed.set(next);
    }

    const onEnd = (event: TransitionEvent): void => {
      if (event.propertyName !== 'max-height' || event.target !== el) return;
      el.removeEventListener('transitionend', onEnd);
      if (!next) {
        // Dépli terminé : plus de plafond, pour qu'un contenu ajouté après
        // coup (ex. données Google arrivées en async) ne soit jamais rogné.
        this.maxHeightPx.set(null);
      }
      this.afterToggle.emit({ collapsed: next });
    };
    el.addEventListener('transitionend', onEnd);
  }
}
