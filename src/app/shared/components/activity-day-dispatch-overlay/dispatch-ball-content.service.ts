import { Injectable, inject } from '@angular/core';
import { ActivityDispatchService } from '@app/core/services/activity-dispatch.service';

/** Ajustement empirique partagé avec le composant — voir sa doc sur `BALL_CONTENT_LEFT_NUDGE_PX`. */
const BALL_CONTENT_LEFT_NUDGE_PX = 5;
/** Rayon/épaisseur de bordure de la miniature — voir la doc de `THUMB_BORDER_LEFT_PX`/`THUMB_BORDER_THIN_PX` côté composant. */
const THUMB_BORDER_LEFT_PX = 6.4; // 0.4rem
const THUMB_BORDER_THIN_PX = 1;

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/**
 * Contenu de la bulle de dispatch : clone DOM du vrai `<app-activity-header>`
 * (voir `cloneOriginHeaderInto`) et animations de tassement/redéploiement de
 * sa poignée/texte, extraits de ActivityDayDispatchOverlayComponent. Reste
 * volontairement séparé de la séquence "voyage/drop/retour" de la bulle
 * elle-même (`playFormAnimation` & cie, toujours dans le composant) : ce
 * service ne connaît que la géométrie du CONTENU de la bulle, pas sa position
 * ni sa phase — voir CLAUDE.md sur le découpage de ce composant.
 *
 * Fourni par ActivityDayDispatchOverlayComponent (pas root) : une instance
 * par overlay (un seul dans l'app, mais suit la même convention que
 * DayScrollSyncService/DayReorderService).
 */
@Injectable()
export class DispatchBallContentService {
  private readonly dispatchService = inject(ActivityDispatchService);

  // Tailles "naturelles" (poignée/texte du clone, écart entre eux) mesurées
  // une seule fois à chaque clonage (voir cloneOriginHeaderInto) — servent de
  // bornes aux animations de collapse/expand du contenu de la bulle,
  // toutes synchronisées sur ELLES, pas sur des durées CSS séparées.
  private ballHandleWidth = 0;
  private ballMetaWidth = 0;
  private ballRowGap = 0;
  /** Padding gauche/droite (symétrique) de `.dispatch-ball__row`, l'enrobage AUTOUR du clone — voir sa doc dans cloneOriginHeaderInto pour pourquoi il doit lui aussi être synchronisé. */
  private ballRowPadding = 0;
  /**
   * Contrairement au contenu de #ballContent (un clone jeté et recréé à
   * chaque décrochage, voir cloneOriginHeaderInto), `.dispatch-ball__row`
   * est LE MÊME nœud DOM d'un drag à l'autre — une animation WAAPI dessus
   * avec `fill: 'forwards'` (voir expandBallContent) continue donc de
   * prévaloir sur toute écriture directe de `.style.paddingLeft/Right` (voir
   * collapseBallContent) tant qu'elle n'est pas explicitement annulée, même
   * une fois "finie". Il faut donc la garder en mémoire et l'annuler avant
   * toute réécriture directe.
   */
  private ballRowPaddingAnimation?: Animation;

  /**
   * Taille "miniature" cible de #ball, une fois collapsé — UNE SEULE
   * définition, utilisée par les 3 séquences qui en ont besoin
   * (playFormAnimation, playDeescalateAnimation, playReturnAnimation) :
   * les avoir dupliquées séparément est justement ce qui a fait dériver la
   * désescalade/le retour (ancienne taille, non compensée) de la formation
   * (nouvelle taille, compensée) après coup — la bulle "n'était plus
   * réagrandie à la taille qu'elle avait en se rétrécissant".
   */
  /**
   * À appeler avant `cloneOriginHeaderInto` en tout début de formation d'un
   * nouveau drag (voir `playFormAnimation` côté composant) : `.dispatch-ball__row`
   * étant un nœud DOM réutilisé d'un drag à l'autre (pas recréé comme le
   * contenu cloné), une éventuelle animation d'expand encore "finie mais pas
   * annulée" d'un drag précédent continuerait sinon de prévaloir sur les
   * écritures directes de `collapseBallContent` pendant tout ce nouveau geste.
   */
  resetForNewDrag(): void {
    this.ballRowPaddingAnimation?.cancel();
    this.ballRowPaddingAnimation = undefined;
  }

  computeCollapsedSize(origin: DOMRect): { width: number; height: number } {
    const thumbSize = Math.min(origin.height, 48);
    // Pas juste la taille de la miniature elle-même, mais CETTE taille +
    // l'épaisseur du bord de #ball à cet instant. `#ball` est en
    // `box-sizing: border-box` (comme le reste de l'appli) : le bord "mange"
    // sur la largeur/hauteur déclarées. Or la miniature
    // (`.activity-header__thumb`) garde une taille FIXE (jamais rétrécie,
    // voir collapseBallContent) — sans cette marge, l'espace intérieur
    // réellement disponible (largeur du bord déduite) devient plus petit que
    // la miniature elle-même, qui se retrouve donc décalée/serrée contre le
    // bord gauche épais au lieu de le toucher exactement.
    return {
      width: thumbSize + THUMB_BORDER_LEFT_PX + THUMB_BORDER_THIN_PX,
      height: thumbSize + THUMB_BORDER_THIN_PX * 2,
    };
  }

  // ── Contenu de la bulle : clone DOM du vrai en-tête d'activité ──────────
  //
  // Au lieu de reconstruire à la main l'apparence de l'en-tête (photo,
  // titre, icône — ce que faisait l'ancien `.dispatch-ball__thumb`/`__text`),
  // on clone le vrai `<app-activity-header>` (voir
  // `ActivityDispatchService.originElement`, renseigné par les appelants de
  // `beginLift`). La photo, déjà résolue dans le DOM source, arrive
  // "gratuitement" — plus besoin de la resouscrire à GooglePhotoService ici.
  // Un seul point délicat : `cloneNode` ne recopie PAS la valeur "vivante"
  // d'un `<input>` (celle posée par Angular via la propriété IDL `.value`,
  // pas l'attribut HTML) — le champ de titre (`app-autocomplete`) cloné se
  // retrouverait donc vide ou obsolète si on ne le réécrivait pas
  // explicitement avec le titre connu (`dragged().title`).
  cloneOriginHeaderInto(container: HTMLElement): void {
    container.replaceChildren();

    const originEl = this.dispatchService.originElement();
    const headerEl = originEl?.querySelector<HTMLElement>('app-activity-header') ?? originEl;
    if (!headerEl) return;

    const clone = headerEl.cloneNode(true) as HTMLElement;
    clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));

    const input = clone.querySelector<HTMLInputElement>('input');
    if (input) {
      input.value = this.dispatchService.dragged()?.title ?? '';
      // Décoratif seulement (toute la bulle est `pointer-events:none`) —
      // évite juste qu'un vrai `<input>` (contrairement à l'ancien contenu
      // fait de `span`/`div`) ne devienne atteignable au clavier (Tab)
      // pendant le drag.
      input.tabIndex = -1;
    }

    container.appendChild(clone);

    // Mesuré une fois ici, juste après insertion (donc juste après layout
    // "au repos", rien encore collapsé) : sert de borne aux animations de
    // collapse/expand du contenu, voir collapseBallContent/expandBallContent.
    const handle = clone.querySelector<HTMLElement>('.drag-handle');
    const meta = clone.querySelector<HTMLElement>('.activity-header__meta');
    const row = clone.querySelector<HTMLElement>('.activity-header__row');
    this.ballHandleWidth = handle?.getBoundingClientRect().width ?? 0;
    this.ballMetaWidth = meta?.getBoundingClientRect().width ?? 0;
    this.ballRowGap = row ? parseFloat(getComputedStyle(row).columnGap) || 0 : 0;
    // `.dispatch-ball__row`, l'enrobage du template du composant (pas du
    // clone) autour de #ballContent — son padding gauche/droite décale lui
    // aussi la miniature par rapport au bord de la bulle, exactement comme
    // le ferait la poignée/l'écart : doit rétrécir en phase avec eux, sinon
    // la miniature reste décalée à droite même une fois poignée/texte à 0,
    // et "saute" au centre quand ce padding finit par disparaître séparément
    // (ancien symptôme avec `.dispatch-ball__row--collapsed`).
    const ballRow = container.parentElement;
    this.ballRowPadding = ballRow ? parseFloat(getComputedStyle(ballRow).paddingLeft) || 0 : 0;

    // La poignée n'a besoin d'aucune animation sur son padding/marge (juste
    // un agrandissement invisible de la zone tactile, voir
    // activity-header.component.scss) : à 0 net, immédiatement, pour que sa
    // largeur puisse réellement atteindre 0 pendant le collapse (sinon le
    // padding, lui, continue de réserver de la place même à `width: 0`).
    if (handle) {
      handle.style.padding = '0';
      handle.style.margin = '0';
    }
  }

  /**
   * Rétrécit poignée/texte/écart EN PHASE avec le rétrécissement de #ball
   * lui-même : appelée à chaque frame de `playCollapseFollow` (composant)
   * avec le MÊME `eased` (0 = état naturel, 1 = totalement collapsé) que
   * celui qui pilote la largeur de #ball — pas une transition CSS séparée
   * avec sa propre durée (source du bug précédent : le texte disparaissait
   * bien plus vite que la bulle ne rétrécissait). `flex: 'none'` sur la
   * poignée/le texte retire leur `flex-shrink`/`flex-grow` naturels : sans
   * ça, l'algorithme flex recalculerait leur taille indépendamment de la
   * valeur qu'on leur impose ici, et les deux se battraient image par image.
   */
  collapseBallContent(container: HTMLElement, eased: number): void {
    const handle = container.querySelector<HTMLElement>('.drag-handle');
    const meta = container.querySelector<HTMLElement>('.activity-header__meta');
    const row = container.querySelector<HTMLElement>('.activity-header__row');
    const ballRow = container.parentElement;

    if (handle) {
      handle.style.flex = 'none';
      handle.style.width = `${lerp(this.ballHandleWidth, 0, eased)}px`;
      handle.style.opacity = `${lerp(1, 0, eased)}`;
    }
    if (meta) {
      meta.style.flex = 'none';
      meta.style.width = `${lerp(this.ballMetaWidth, 0, eased)}px`;
      meta.style.opacity = `${lerp(1, 0, eased)}`;
    }
    if (row) {
      row.style.gap = `${lerp(this.ballRowGap, 0, eased)}px`;
    }
    // `.dispatch-ball__row` (l'enrobage, pas le clone) : son padding gauche/
    // droite doit rétrécir dans le MÊME mouvement, sinon la miniature reste
    // décalée à droite même une fois poignée/texte à 0 — voir la doc dans
    // cloneOriginHeaderInto.
    if (ballRow) {
      const padding = `${lerp(this.ballRowPadding, 0, eased)}px`;
      ballRow.style.paddingLeft = padding;
      ballRow.style.paddingRight = padding;
    }
    // Voir la doc de BALL_CONTENT_LEFT_NUDGE_PX.
    container.style.marginLeft = `${lerp(0, -BALL_CONTENT_LEFT_NUDGE_PX, eased)}px`;
  }

  /**
   * Inverse de `collapseBallContent`, mais en WAAPI (pas de doigt à suivre
   * ici, position et durée sont fixes) : joué en PARALLÈLE de l'animation de
   * la bulle elle-même (même `duration`/`easing`, démarré dans le même bloc
   * synchrone côté composant), pour que la réouverture de la carte et la
   * réapparition de poignée/texte se fassent dans le même mouvement — pas
   * l'une après l'autre (symptôme observé : la photo se décale d'abord, puis
   * la carte s'élargit ensuite).
   */
  expandBallContent(container: HTMLElement, durationMs: number): void {
    const handle = container.querySelector<HTMLElement>('.drag-handle');
    const meta = container.querySelector<HTMLElement>('.activity-header__meta');
    const row = container.querySelector<HTMLElement>('.activity-header__row');
    const ballRow = container.parentElement;
    const options: KeyframeAnimationOptions = { duration: durationMs, easing: 'ease-in-out', fill: 'forwards' };

    handle?.animate(
      [{ width: '0px', opacity: 0 }, { width: `${this.ballHandleWidth}px`, opacity: 1 }],
      options,
    );
    meta?.animate(
      [{ width: '0px', opacity: 0 }, { width: `${this.ballMetaWidth}px`, opacity: 1 }],
      options,
    );
    row?.animate(
      [{ gap: '0px' }, { gap: `${this.ballRowGap}px` }],
      options,
    );
    // Voir la doc de BALL_CONTENT_LEFT_NUDGE_PX — `container` (#ballContent)
    // est jeté/recréé à chaque décrochage (cloneOriginHeaderInto), donc pas
    // besoin de la même protection contre une animation résiduelle que
    // `.dispatch-ball__row` juste en dessous.
    container.animate(
      [{ marginLeft: `-${BALL_CONTENT_LEFT_NUDGE_PX}px` }, { marginLeft: '0px' }],
      options,
    );

    // `.dispatch-ball__row` : nœud réutilisé d'un drag à l'autre (voir sa
    // doc sur `ballRowPaddingAnimation`) — on annule l'éventuelle précédente
    // avant d'en lancer une nouvelle.
    this.ballRowPaddingAnimation?.cancel();
    this.ballRowPaddingAnimation = ballRow?.animate(
      [
        { paddingLeft: '0px', paddingRight: '0px' },
        { paddingLeft: `${this.ballRowPadding}px`, paddingRight: `${this.ballRowPadding}px` },
      ],
      options,
    );
  }
}
