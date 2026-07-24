import { ElementRef, Injectable, inject, signal } from '@angular/core';
import { ActivityDispatchService } from '@app/core/services/activity-dispatch.service';
import { TripTab } from '@app/features/trips/trip-detail/trip-tab.model';

/** FLIP des onglets de jours visibles vers leur bouton de grille correspondant. */
const TAB_FLIP_DURATION = 300;

/**
 * Réplique DOM de la barre de jours (`app-trip-tabs-nav`) affichée au repos
 * dans le calendrier de dispatch, et FLIP de ses onglets vers les boutons de
 * la grille à l'ouverture (voir `cloneNavBarInto`/`runTabFlip`) — extrait de
 * ActivityDayDispatchOverlayComponent.
 *
 * Fourni par ActivityDayDispatchOverlayComponent (pas root).
 */
@Injectable()
export class DispatchReplicaService {
  private readonly dispatchService = inject(ActivityDispatchService);

  /** Clés des jours dont l'onglet de la barre repliée est en train de "devenir" le bouton de la grille (FLIP) : l'onglet d'origine s'efface pendant que le bouton anime depuis sa position. Lu par le template du composant. */
  readonly flippedDayIds = signal<ReadonlySet<string>>(new Set());

  /** Racine du dernier clone DOM inséré dans #replicaNav (voir cloneNavBarInto) — pas un viewChild : ce n'est pas du DOM rendu par Angular. */
  private replicaCloneRoot?: HTMLElement;
  private currentTabFlipAnimations: Animation[] = [];

  getCloneRoot(): HTMLElement | undefined {
    return this.replicaCloneRoot;
  }

  // ── Clone DOM de la barre de jours (réplique exacte, scroll inclus) ─────
  //
  // Un vrai `cloneNode(true)` de `.app-tabs` (voir
  // ActivityDispatchService.registerNavBarCloneSource) plutôt qu'une
  // re-création Angular parallèle : garantit que la réplique montre EXACTEMENT
  // ce que montre la vraie barre au moment du décrochage — y compris son
  // décalage de scroll horizontal courant (donc quel que soit le jour actif,
  // pas seulement quand "Général" est visible à gauche). `cloneNode` ne
  // recopie pas le `scrollLeft` des descendants scrollables : on le fait à la
  // main juste après insertion.
  cloneNavBarInto(container: HTMLElement): void {
    const source = this.dispatchService.getNavBarCloneSource();
    container.replaceChildren();
    this.replicaCloneRoot = undefined;
    if (!source) return;

    const clone = source.cloneNode(true) as HTMLElement;
    clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
    container.appendChild(clone);

    const sourceScroller = source.querySelector<HTMLElement>('.app-tabs__list');
    const cloneScroller = clone.querySelector<HTMLElement>('.app-tabs__list');
    if (sourceScroller && cloneScroller) {
      // Force une passe de layout synchrone avant d'écrire `scrollLeft` : à
      // peine inséré (juste après cet `appendChild`), le clone n'a pas encore
      // de zone scrollable établie côté navigateur, donc l'écriture pouvait
      // être clampée à 0 silencieusement — d'où le décalage de scroll
      // (réplique toujours à gauche, même en scrollant sur un jour éloigné).
      void cloneScroller.offsetWidth;
      cloneScroller.scrollLeft = sourceScroller.scrollLeft;
    }

    this.replicaCloneRoot = clone;
  }

  // ── FLIP des onglets de jours visibles vers les boutons de la grille ─────
  //
  // Les onglets déjà visibles dans la barre repliée (hors "Général", qui n'a
  // pas d'équivalent dans la grille) ne se contentent pas d'apparaître en
  // dessous : ils "deviennent" littéralement le bouton correspondant de la
  // grille — même technique FLIP que la bulle (mesurer avant, mesurer après,
  // WAAPI entre les deux), appliquée ici à chaque bouton concerné. Le
  // matching se fait par `data-tab-id` (posé sur chaque `.app-tab` réel, donc
  // présent sur le clone) plutôt que par index : robuste à n'importe quel
  // décalage de scroll de la barre d'origine.
  captureVisibleTabFlipTargets(tabs: readonly TripTab[]): Map<string, DOMRect> {
    const map = new Map<string, DOMRect>();
    const root = this.replicaCloneRoot;
    if (!root) return map;

    const navRect = root.getBoundingClientRect();

    for (const tab of tabs) {
      if (tab.id === 'notes') continue;
      const el = root.querySelector<HTMLElement>(`[data-tab-id="${tab.id}"]`);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const isVisible = rect.width > 0 && rect.right > navRect.left && rect.left < navRect.right;
      if (!isVisible) continue;
      map.set(tab.id, rect);
    }
    return map;
  }

  runTabFlip(targets: Map<string, DOMRect>, cells: readonly ElementRef<HTMLElement>[]): void {
    this.stopTabFlipAnimations();
    if (targets.size === 0) return;

    for (const cell of cells) {
      const el = cell?.nativeElement;
      if (!el) continue;
      const key = el.dataset['dayKey'];
      const startRect = key ? targets.get(key) : undefined;
      if (!startRect) continue;

      const finalRect = el.getBoundingClientRect();
      const anim = el.animate(
        [
          {
            transform: `translate3d(${startRect.left - finalRect.left}px, ${startRect.top - finalRect.top}px, 0)`,
            width: `${startRect.width}px`,
            height: `${startRect.height}px`,
            borderRadius: '8px',
          },
          {
            transform: 'translate3d(0, 0, 0)',
            width: `${finalRect.width}px`,
            height: `${finalRect.height}px`,
            borderRadius: '999px',
          },
        ],
        { duration: TAB_FLIP_DURATION, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'both' },
      );
      this.currentTabFlipAnimations.push(anim);
      anim.finished.then(() => anim.cancel()).catch(() => { /* annulée : un nouveau geste a pris le relais */ });
    }
  }

  private stopTabFlipAnimations(): void {
    this.currentTabFlipAnimations.forEach(a => a.cancel());
    this.currentTabFlipAnimations = [];
  }

  /** Appelé en sortie de 'lifted' (drop/retour) : les onglets d'origine redeviennent visibles. */
  cancelTabFlip(): void {
    this.stopTabFlipAnimations();
    this.flippedDayIds.set(new Set());
  }
}
