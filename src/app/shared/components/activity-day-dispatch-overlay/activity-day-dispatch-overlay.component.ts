import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, signal, untracked, viewChild, viewChildren
} from '@angular/core';
import { ButtonComponent } from '@app/shared/components/button/button.component';
import { Day } from '@app/features/trips/trip.model';
import { TripTab } from '@app/features/trips/trip-detail/trip-tab.model';
import { TripFacade } from '@app/features/trips/trip-facade.service';
import { ActivityDispatchService } from '@app/core/services/activity-dispatch.service';
import { DispatchBallContentService } from './dispatch-ball-content.service';
import { DispatchReplicaService } from './dispatch-replica.service';
import { DispatchHoverEscalationService } from './dispatch-hover-escalation.service';

interface MonthGroup {
  label: string;
  days: Day[];
}

// ── Constantes d'animation ───────────────────────────────────────────────
// Volontairement lentes pour l'instant (validation du comportement) :
// à accélérer une fois le mécanisme approuvé.
const BALL_SIZE = 56;
/** Phase 1 de la formation de la bulle : le texte se tasse depuis la droite. */
const TEXT_COLLAPSE_DURATION = 250;
/** Phase 2 : la bulle voyage vers le doigt en s'arrondissant, le contour l'enveloppe. */
const BALL_TRAVEL_DURATION = 300;
const DROP_DURATION = 250;
/** Retour "aimant" (pool uniquement) : trajet inverse vers la carte d'origine puis redéploiement du texte. */
const RETURN_TRAVEL_DURATION = 300;
const RETURN_EXPAND_DURATION = 250;
/** Désescalade (jour), phase 1 : la bulle ronde redevient une miniature (bords/rayon), sur place — même durée que RETURN_TRAVEL_DURATION côté pool (sinon le redéploiement y paraît plus lent). */
const DAY_DRAG_COLLAPSE_DURATION_MS = 300;
/** Désescalade (jour), phase 2 : la miniature se réélargit jusqu'à la taille pleine de la carte d'origine (révèle poignée/texte) — symétrique de RETURN_EXPAND_DURATION côté pool. */
const DAY_DRAG_EXPAND_DURATION_MS = 250;
const EDGE_SCROLL_ZONE = 56;
const EDGE_SCROLL_SPEED = 8;
/**
 * Durée de la "montée" du calendrier (croissance du sheet, effacement de la
 * réplique, apparition de la grille) : les trois animations partagent cette
 * même durée, calculée à chaque décrochage à partir de la distance réelle
 * (px) parcourue par le sheet, pour rester à vitesse constante quelle que
 * soit la hauteur d'écran — sans quoi un grand écran (plus de px à parcourir
 * en 50vh) ferait paraître le morph plus rapide qu'un petit.
 */
const EXPAND_DURATION_BASE_MS = 300;
const EXPAND_DURATION_PX_FACTOR_MS = 0.7;
const EXPAND_DURATION_MIN_MS = 300;
const EXPAND_DURATION_MAX_MS = 650;
/** Doit rester synchronisé avec `max-height: 50vh` sur `.dispatch-overlay--expanded .dispatch-overlay__sheet` (scss). */
const EXPANDED_HEIGHT_VH_RATIO = 0.5;
/** Rayon/épaisseurs de bordure de la miniature (phase 2, point de départ) et de la bulle (point d'arrivée), en px. */
const THUMB_BORDER_RADIUS_PX = 12;
const THUMB_BORDER_LEFT_PX = 6.4; // 0.4rem
/** Épaisseur du fin liseré gris (haut/droite/bas) au repos, identique à celle de l'activity-header (bordure p-panel par défaut). */
const THUMB_BORDER_THIN_PX = 1;
/** Variable CSS du liseré gris de l'activity-header (même bordure que `app-panel`, voir panel.component.scss). */
const THUMB_BORDER_GRAY = 'var(--nt-content-border-color)';
const BALL_BORDER_WIDTH_PX = 3;

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

@Component({
  selector: 'app-activity-day-dispatch-overlay',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './activity-day-dispatch-overlay.component.html',
  styleUrl: './activity-day-dispatch-overlay.component.scss',
  // Une instance par overlay (pas root) : voir la doc des 3 services.
  providers: [DispatchBallContentService, DispatchReplicaService, DispatchHoverEscalationService],
})
export class ActivityDayDispatchOverlayComponent {
  protected readonly dispatchService = inject(ActivityDispatchService);
  private readonly tripFacade = inject(TripFacade);
  private readonly ballContentService = inject(DispatchBallContentService);
  protected readonly replica = inject(DispatchReplicaService);
  private readonly hoverEscalation = inject(DispatchHoverEscalationService);

  readonly days = input<Day[]>([]);
  /** Mêmes onglets que app-trip-tabs-nav (Général + jours), pour en afficher une réplique identique au repos. */
  readonly tabs = input<TripTab[]>([]);
  /** Jour (ou 'notes') actuellement visible dans le swiper, utilisé comme zone de dépose de secours quand le calendrier est rétracté. */
  readonly activeDayId = input<string>('');

  private readonly sheetRef = viewChild<ElementRef<HTMLElement>>('sheet');
  private readonly gridRef = viewChild<ElementRef<HTMLElement>>('grid');
  private readonly ballRef = viewChild<ElementRef<HTMLElement>>('ball');
  private readonly ballContentRef = viewChild<ElementRef<HTMLElement>>('ballContent');
  private readonly replicaNavRef = viewChild<ElementRef<HTMLElement>>('replicaNav');
  // `read: ElementRef` est indispensable ici : ces éléments portent le
  // composant `app-button`, donc sans lui, la référence résout vers
  // l'instance du composant (pas d'`.nativeElement`) et non vers l'élément
  // DOM — c'est ce qui provoquait le crash "Cannot read properties of
  // undefined (reading 'dataset')".
  private readonly cellRefs = viewChildren('dayCell', { read: ElementRef<HTMLElement> });

  protected readonly dragged = this.dispatchService.dragged;
  protected readonly phase = this.dispatchService.phase;

  /** true une fois la bulle "formée" : à partir de là elle suit le pointeur en direct via binding, plus de WAAPI. */
  protected readonly formed = signal(false);
  /** true une fois le texte tassé (fin de la phase 1) : la miniature quitte le flux et remplit toute la bulle (phase 2). */
  protected readonly thumbFilled = signal(false);
  /** true une fois le calendrier pleinement déployé (morph terminé) : gouverne désormais son affichage par CSS simple. */
  protected readonly sheetExpanded = signal(false);
  /** Hauteur exacte (px) de la vraie barre d'onglets, mesurée à chaque décrochage : permet au clone de la superposer au pixel près avant de grandir. */
  protected readonly collapsedHeight = signal(56);
  /** Durée (ms) partagée par la croissance du sheet, l'effacement de la réplique et la montée de la grille — voir `EXPAND_DURATION_BASE_MS`. */
  protected readonly expandDurationMs = signal(700);

  protected readonly monthGroups = computed<MonthGroup[]>(() => this.groupByMonth(this.days()));

  protected readonly countsByDay = computed(() => {
    const map = new Map<string, number>();
    for (const day of this.days()) {
      map.set(this.dayKeyFor(day), this.tripFacade.getDayActivities(day.id)().length);
    }
    return map;
  });

  protected readonly ballTransform = computed(() => {
    const p = this.dispatchService.pointer();
    return `translate3d(${p.x - BALL_SIZE / 2}px, ${p.y - BALL_SIZE / 2}px, 0)`;
  });

  private currentBallAnimation?: Animation;
  private travelFollowLoop?: number;
  private edgeScrollLoop?: number;
  private sheetTransitionListenerBound = false;

  constructor() {
    // Amorce le clone + la hauteur repliée UNE FOIS que la vraie barre s'est
    // enregistrée (voir `ActivityDispatchService.registerNavBarCloneSource`),
    // pas au premier rendu DE CE composant : `TripTabsNavComponent` n'est
    // monté qu'une fois le trip chargé (async, derrière un `@if`), donc
    // potentiellement APRÈS le premier rendu de cet overlay — un
    // `afterNextRender` one-shot ici s'exécutait alors trop tôt (avant que
    // `registerNavBarCloneSource` n'ait jamais été appelé), et ne se
    // redéclenchant jamais, l'amorçage échouait silencieusement pour le
    // reste de la session. En réagissant au signal d'enregistrement lui-même,
    // l'amorçage a lieu au bon moment quel que soit l'ordre de montage. Aucun
    // drag n'est en cours à cet instant (aucun risque pour le
    // MutationObserver de Swiper, voir la note détaillée dans `openSheet` sur
    // pourquoi on ne reclone JAMAIS pendant un cdkDrag pré-escalade) : sans
    // cet amorçage, l'aperçu "barre repliée" affiché dès le tout premier
    // cdkDrag de la session (`sheetVisible`/`--bar-visible`, voir
    // ActivityDispatchService) restait vide et à la hauteur par défaut
    // (56px, celle du fallback CSS) tant qu'aucune escalade réelle
    // (`openSheet`) n'avait encore eu lieu — d'où le contenu tronqué observé
    // uniquement au tout premier survol de la barre, jamais ensuite.
    this.hoverEscalation.connect({
      getSheetEl: () => this.sheetRef()?.nativeElement ?? null,
    });

    let replicaPreviewPrimed = false;
    effect(() => {
      const cloneSource = this.dispatchService.getNavBarCloneSource();
      if (!cloneSource || replicaPreviewPrimed) return;
      replicaPreviewPrimed = true;
      this.primeReplicaPreview();
    });

    // La demande de dispatch réelle est émise par le service ; c'est ici,
    // dans un contexte qui a accès au TripFacade (fourni au niveau de la
    // route trips), qu'on l'exécute réellement contre le store.
    effect(() => {
      const req = this.dispatchService.dropRequested();
      if (!req) return;
      this.tripFacade.dispatchActivity(req.tripId, req.activityId, req.origin, new Date(req.dayKey));
    });

    // Synchronise sur le clone courant les classes pilotées par les signaux
    // d'animation (le clone étant du DOM brut, pas du template Angular, rien
    // ne les lui applique automatiquement).
    effect(() => {
      const expanded = this.sheetExpanded();
      const flipped = this.replica.flippedDayIds();
      const root = this.replica.getCloneRoot();
      if (!root) return;

      // "Général" (id 'notes') n'a pas d'équivalent dans la grille : il
      // s'efface pour de bon à l'expansion, où qu'il soit (visible ou
      // scrollé hors champ — dans ce dernier cas l'effet est simplement
      // invisible, sans conséquence).
      const notesEl = root.querySelector<HTMLElement>('[data-tab-id="notes"]');
      notesEl?.classList.toggle('dispatch-overlay__replica-tab--out', expanded);

      root.querySelectorAll<HTMLElement>('[data-tab-id]').forEach(el => {
        const id = el.dataset['tabId'];
        if (!id || id === 'notes') return;
        el.classList.toggle('dispatch-overlay__replica-tab--flipped', flipped.has(id));
      });
    });

    // Bascule "remplissage" de la miniature clonée (voir cloneOriginHeaderInto) :
    // même remarque que ci-dessus, un `[class.x]` de template ne peut pas
    // cibler un nœud inséré à la main dans #ballContent.
    effect(() => {
      const filled = this.thumbFilled();
      const thumb = this.ballContentRef()?.nativeElement.querySelector<HTMLElement>('.activity-header__thumb');
      thumb?.classList.toggle('activity-header__thumb--fill', filled);
    });

    // Attention : seul `phase()` doit être une dépendance réactive de cet
    // effet. Toutes les méthodes appelées lisent d'autres signaux (pointer,
    // dragged, hoveredDayRect...) juste pour une valeur instantanée à cet
    // endroit précis de la séquence — pas pour se redéclencher à chaque
    // frame. D'où le `untracked()` : sans lui, `playFormAnimation` (qui lit
    // `pointer()`) redémarre son animation à CHAQUE pointermove, et la bulle
    // ne fait plus que "clignoter" vers sa position de départ.
    effect(() => {
      const phase = this.phase();
      untracked(() => {
        if (phase === 'lifted') {
          this.sheetExpanded.set(false);
          this.playFormAnimation();
          this.openSheet();
          this.startEdgeAutoScroll();
        } else if (phase === 'dropping') {
          this.stopEdgeAutoScroll();
          this.hoverEscalation.clearLeaveTimer();
          this.replica.cancelTabFlip();
          this.playDropAnimation();
        } else if (phase === 'returning') {
          this.stopEdgeAutoScroll();
          this.hoverEscalation.clearLeaveTimer();
          this.sheetExpanded.set(false);
          this.replica.cancelTabFlip();
          this.playReturnAnimation();
        } else if (phase === 'deescalating') {
          this.stopEdgeAutoScroll();
          this.hoverEscalation.clearLeaveTimer();
          this.sheetExpanded.set(false);
          this.replica.cancelTabFlip();
          this.playDeescalateAnimation();
        }
      });
    });

    // Surveille en direct la position du doigt pendant un geste jour déjà
    // escaladé, pour désescalader si le doigt s'éloigne trop longtemps du
    // calendrier — le pool, lui, ne se replie jamais une fois affiché.
    effect(() => {
      const pointer = this.dispatchService.pointer();
      if (this.phase() === 'lifted' && this.sheetExpanded() && this.dragged()?.origin === 'day') {
        this.hoverEscalation.checkLeaveSheet(pointer);
      }
    });

    // Survol pré-escalade : pendant un cdkDrag dans un jour pas encore
    // escaladé, surveille si le doigt survole la barre repliée assez
    // longtemps pour déclencher l'escalade vers le calendrier.
    effect(() => {
      const pointer = this.dispatchService.pointer();
      const dragInfo = this.dispatchService.activeDayDrag();
      if (this.phase() === 'idle' && dragInfo) {
        this.hoverEscalation.checkEscalate(pointer, dragInfo);
      } else {
        this.hoverEscalation.clearEscalateTimer();
      }
    });
  }

  protected dayKeyFor(day: Day): string {
    return day.id.toISOString();
  }

  protected onGridScroll(): void {
    if (this.phase() === 'lifted') {
      this.captureCellRects();
    }
  }

  private groupByMonth(days: Day[]): MonthGroup[] {
    const formatter = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
    const groups = new Map<string, Day[]>();
    for (const day of days) {
      const label = capitalize(formatter.format(day.id));
      groups.set(label, [...(groups.get(label) ?? []), day]);
    }
    return [...groups.entries()].map(([label, groupDays]) => ({ label, days: groupDays }));
  }

  // Ce hit-testing tourne à chaque frame de scroll/auto-scroll pendant un
  // drag : une exception ici ne doit JAMAIS remonter non attrapée, sinon elle
  // interrompt le scheduler de rendu d'Angular en plein milieu d'un cycle et
  // fige tout le reste (la bulle cesse de suivre le doigt, plus d'animation
  // de retour possible) — c'est exactement le symptôme observé le jour où
  // `#dayCell` résolvait vers la directive `pButton` au lieu de l'élément DOM.
  private captureCellRects(): void {
    try {
      const map = new Map<string, DOMRect>();
      for (const cell of this.cellRefs()) {
        const el = cell?.nativeElement;
        if (!el) continue;
        const key = el.dataset['dayKey'];
        if (key) map.set(key, el.getBoundingClientRect());
      }
      this.dispatchService.registerDayCells(map);
    } catch (err) {
      console.error('[dispatch-overlay] captureCellRects a échoué', err);
    }
  }

  // ── Auto-scroll en bord de grille pendant le drag ──────────────────────────

  private startEdgeAutoScroll(): void {
    this.stopEdgeAutoScroll();
    const step = () => {
      if (this.phase() !== 'lifted') {
        this.edgeScrollLoop = undefined;
        return;
      }
      const grid = this.gridRef()?.nativeElement;
      if (grid && this.sheetExpanded()) {
        const rect = grid.getBoundingClientRect();
        const { y } = this.dispatchService.pointer();
        if (y - rect.top < EDGE_SCROLL_ZONE) {
          grid.scrollTop -= EDGE_SCROLL_SPEED;
          this.captureCellRects();
        } else if (rect.bottom - y < EDGE_SCROLL_ZONE) {
          grid.scrollTop += EDGE_SCROLL_SPEED;
          this.captureCellRects();
        }
      }
      this.edgeScrollLoop = requestAnimationFrame(step);
    };
    this.edgeScrollLoop = requestAnimationFrame(step);
  }

  private stopEdgeAutoScroll(): void {
    if (this.edgeScrollLoop) {
      cancelAnimationFrame(this.edgeScrollLoop);
      this.edgeScrollLoop = undefined;
    }
  }

  /**
   * Clone + mesure la barre repliée, sans rien d'autre (pas d'expansion, pas
   * de FLIP de la grille) : appelé une fois à l'amorçage (constructeur, via
   * `afterNextRender`, aucun drag en cours donc aucun risque pour le
   * MutationObserver de Swiper) ET à chaque décrochage réel (`openSheet`,
   * phase 'lifted') — jamais entre les deux, voir la note détaillée dans
   * `openSheet`.
   */
  private primeReplicaPreview(): void {
    const replicaContainer = this.replicaNavRef()?.nativeElement;
    if (replicaContainer) this.replica.cloneNavBarInto(replicaContainer);

    const navRect = this.dispatchService.getNavBarRect();
    if (navRect) this.collapsedHeight.set(navRect.height);
  }

  // ── Ouverture du calendrier : la barre d'onglets grandit sur elle-même ────
  //
  // Le clone (#replicaNav + #grid dans #sheet) est un composant à part,
  // caché en `display:none` au repos et positionné EXACTEMENT comme la
  // vraie barre (fixed left/right/bottom). Au décrochage, il ne fait que
  // passer en `display:flex` à la même hauteur mesurée que la vraie barre —
  // rigoureusement identique, donc rien ne se voit. Ce n'est qu'ensuite,
  // une fois cet état "invisible" réellement peint, qu'on bascule la classe
  // qui fait grandir sa hauteur en transition CSS pure (pas de FLIP/WAAPI) :
  // la barre s'étire donc littéralement sur place, ancrée en bas.
  private openSheet(): void {
    // Le (re)clonage ne se fait QU'ici et à l'amorçage initial
    // (`primeReplicaPreview`, voir le constructeur), jamais dès que la barre
    // repliée devient un simple survol pré-escalade (`sheetVisible`) : un
    // remplacement du sous-arbre DOM de #replicaNav à CHAQUE début de
    // cdkDrag dans un jour — même les réordonnancements qui n'escaladent
    // jamais vers le calendrier — se faisait repérer par le
    // MutationObserver de Swiper (`observeParents`/`observeSlideChildren`
    // dans TripDaySwiperComponent, qui observe le sous-arbre entier d'un
    // ancêtre commun, donc aussi cette barre sœur) et déclenchait un
    // `update()` en pleine séquence de pointeur, cassant le drag maison
    // (retour immédiat au moindre pointermove, swipe qui récupère le
    // geste). Ici, une seule fois par décrochage réel (phase 'lifted'),
    // c'est sans risque : re-mesurer/re-cloner à chaque vraie escalade
    // garde la réplique fidèle à un éventuel scroll entre-temps.
    this.primeReplicaPreview();

    const expandedHeightPx = window.innerHeight * EXPANDED_HEIGHT_VH_RATIO;
    const travelPx = Math.max(0, expandedHeightPx - this.collapsedHeight());
    const duration = EXPAND_DURATION_BASE_MS + travelPx * EXPAND_DURATION_PX_FACTOR_MS;
    this.expandDurationMs.set(Math.round(
      Math.min(EXPAND_DURATION_MAX_MS, Math.max(EXPAND_DURATION_MIN_MS, duration)),
    ));

    // Les onglets de jours actuellement visibles dans la barre repliée
    // doivent être mesurés MAINTENANT, avant que quoi que ce soit ne bouge :
    // c'est leur position/taille de départ pour le FLIP qui les transforme
    // en boutons de la grille.
    const flipTargets = this.replica.captureVisibleTabFlipTargets(this.tabs());
    this.replica.flippedDayIds.set(new Set(flipTargets.keys()));

    this.bindSheetTransitionEnd();

    // Double rAF : sans ce délai, le navigateur peut fusionner "apparition à
    // hauteur repliée" et "croissance" dans le même recalcul de style, et la
    // transition CSS ne se joue tout simplement pas (aucun état de départ
    // n'a jamais été peint pour qu'elle ait quelque chose à animer).
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (this.phase() !== 'lifted') return;
        this.sheetExpanded.set(true);
        requestAnimationFrame(() => {
          this.captureCellRects();
          // Le grid final est layouté (sa largeur ne dépend pas de la
          // hauteur du sheet encore en train de grandir) : on peut donc
          // déjà lire la position finale de chaque bouton et lancer le FLIP
          // sans attendre la fin de la transition CSS de hauteur.
          this.replica.runTabFlip(flipTargets, this.cellRefs());
        });
      });
    });
  }

  private bindSheetTransitionEnd(): void {
    if (this.sheetTransitionListenerBound) return;
    const sheet = this.sheetRef()?.nativeElement;
    if (!sheet) return;
    this.sheetTransitionListenerBound = true;
    sheet.addEventListener('transitionend', (e: TransitionEvent) => {
      if (e.propertyName === 'height' && e.target === sheet) this.captureCellRects();
    });
  }

  // ── Formation / voyage / retour de la bulle ────────────────────────────────

  /**
   * Séquence complète de formation, en deux temps comme demandé :
   *  1. Le header (identique à la carte) se tasse depuis la droite : le
   *     texte et la poignée s'effacent, ne reste que la miniature.
   *  2. Cette miniature voyage vers le doigt en s'arrondissant en bulle, le
   *     bord gauche coloré s'étirant pour en faire le tour.
   *
   * Les deux phases tournent en rAF (comme `playTravelFollow`) et relisent
   * `pointer()` à chaque frame plutôt que de figer un trajet WAAPI vers un
   * point de départ : sinon la bulle ignore le doigt tant que le tassement
   * du texte n'est pas terminé, et un drag entamé pendant cette phase 1 ne
   * la fait pas suivre le geste.
   */
  private playFormAnimation(): void {
    const ball = this.ballRef()?.nativeElement;
    const origin = this.dispatchService.originRect();
    if (!ball || !origin) return;

    this.formed.set(false);
    this.thumbFilled.set(false);
    this.currentBallAnimation?.cancel();
    this.currentBallAnimation = undefined;
    // Nœud réutilisé d'un drag à l'autre (voir sa doc) : sans cette
    // annulation, une éventuelle réouverture précédente encore "finie mais
    // pas annulée" continuerait de prévaloir sur les écritures directes de
    // `collapseBallContent` pendant tout ce nouveau décrochage.
    this.ballContentService.resetForNewDrag();
    this.stopTravelFollow();

    // Une seule fois par décrochage (comme cloneNavBarInto — voir la note
    // dans openSheet sur le MutationObserver de Swiper) : le contenu de la
    // bulle n'est plus reconstruit à la main, c'est un clone DOM du vrai
    // <app-activity-header> de la carte.
    const ballContent = this.ballContentRef()?.nativeElement;
    if (ballContent) {
      this.ballContentService.cloneOriginHeaderInto(ballContent);
      // Seed synchrone à l'état "naturel" (eased = 0) — même raison que pour
      // la géométrie de #ball juste en dessous : sans ça, le padding de
      // `.dispatch-ball__row` (nœud réutilisé, voir ballRowPaddingAnimation)
      // pourrait rester à sa valeur résiduelle d'un drag précédent le temps
      // d'une frame avant que `playCollapseFollow` ne prenne la main.
      this.ballContentService.collapseBallContent(ballContent, 0);
    }

    const { width: collapsedWidth, height: collapsedHeight } = this.ballContentService.computeCollapsedSize(origin);

    // Position de départ : mêmes bords ET même géométrie (taille/position)
    // que l'activity-header/le clone qu'on masque à cet instant — posés SANS
    // transition, pour un état identique au pixel près dès la première frame.
    // Point important pour la taille/position : `playCollapseFollow` (plus
    // bas) ne les fixe que dans sa boucle `requestAnimationFrame`, donc SANS
    // ce réglage synchrone ici, la bulle est peinte au moins une frame avec
    // sa géométrie résiduelle du drag précédent (ou aucune, au tout premier
    // drag — position par défaut en haut à gauche) avant de "sauter" à la
    // bonne place : c'est ce raté qui rendait la formation de la bulle
    // saccadée plutôt que fluide.
    ball.style.transition = 'none';
    ball.style.width = `${origin.width}px`;
    ball.style.height = `${origin.height}px`;
    ball.style.transform = `translate3d(${origin.left}px, ${origin.top}px, 0)`;
    ball.style.borderTopWidth = `${THUMB_BORDER_THIN_PX}px`;
    ball.style.borderRightWidth = `${THUMB_BORDER_THIN_PX}px`;
    ball.style.borderBottomWidth = `${THUMB_BORDER_THIN_PX}px`;
    ball.style.borderLeftWidth = `${THUMB_BORDER_LEFT_PX}px`;
    ball.style.borderTopColor = THUMB_BORDER_GRAY;
    ball.style.borderRightColor = THUMB_BORDER_GRAY;
    ball.style.borderBottomColor = THUMB_BORDER_GRAY;
    ball.style.borderRadius = `${THUMB_BORDER_RADIUS_PX}px`;
    void ball.offsetHeight; // flush layout/style avant de réactiver les transitions
    ball.style.transition = '';

    this.playCollapseFollow(ball, ballContent ?? null, origin, collapsedWidth, collapsedHeight);
  }

  /**
   * Phase 1 : le texte se tasse vers la gauche — le bord gauche reste
   * IMMOBILE en abscisse pendant tout le tassement (seul le bord droit
   * recule), pour un effet "le texte disparaît sur place" plutôt qu'une
   * carte qui glisserait déjà vers le doigt. Le voyage horizontal vers le
   * doigt est le rôle de la phase 2 (`playTravelFollow`), une fois la bulle
   * formée.
   */
  private playCollapseFollow(
    ball: HTMLElement,
    content: HTMLElement | null,
    origin: DOMRect,
    collapsedWidth: number,
    collapsedHeight: number,
  ): void {
    const startTime = performance.now();

    const step = (now: number) => {
      if (this.phase() !== 'lifted') {
        this.travelFollowLoop = undefined;
        return;
      }

      const t = Math.min(1, (now - startTime) / TEXT_COLLAPSE_DURATION);
      const eased = easeInOutCubic(t);
      const target = this.dispatchService.pointer();

      const width = lerp(origin.width, collapsedWidth, eased);
      const height = lerp(origin.height, collapsedHeight, eased);
      const left = origin.left;
      const top = lerp(origin.top, target.y - height / 2, eased);

      ball.style.width = `${width}px`;
      ball.style.height = `${height}px`;
      ball.style.transform = `translate3d(${left}px, ${top}px, 0)`;
      if (content) this.ballContentService.collapseBallContent(content, eased);

      if (t >= 1) {
        this.travelFollowLoop = undefined;
        // La miniature quitte le flux et remplit désormais exactement le
        // conteneur, quelle que soit sa taille à chaque instant de la phase 2
        // (transition CSS, pas de calcul JS supplémentaire nécessaire).
        this.thumbFilled.set(true);
        this.startBorderColorTransition(ball);
        this.playTravelFollow(ball, left, top, width, height);
        return;
      }
      this.travelFollowLoop = requestAnimationFrame(step);
    };

    this.travelFollowLoop = requestAnimationFrame(step);
  }

  /**
   * Déclenche, une seule fois à l'entrée de la phase 2, le passage du fin
   * liseré gris (haut/droite/bas) vers la couleur de l'activité — via une
   * transition CSS plutôt qu'un lerp RGB manuel : `color` est une valeur déjà
   * résolue (voir `resolveRingColor`), donc le navigateur sait l'interpoler
   * seul. L'épaisseur, elle, continue d'être pilotée image par image dans
   * `playTravelFollow` (cohérent avec le reste de la bulle), la transition
   * CSS posée ici ne portant donc que sur `border-color`.
   */
  private startBorderColorTransition(ball: HTMLElement): void {
    const color = this.dragged()?.color ?? 'var(--nt-primary-color)';
    ball.style.transition = `border-color ${BALL_TRAVEL_DURATION}ms ease`;
    ball.style.borderTopColor = color;
    ball.style.borderRightColor = color;
    ball.style.borderBottomColor = color;
  }

  /**
   * Inverse de `startBorderColorTransition` : la bulle (bords colorés
   * uniformes) redevient la carte au repos (fin liseré gris 3 côtés, bord
   * gauche épais qui reste coloré) — utilisé par `playReturnAnimation` et
   * `playDeescalateAnimation`. `border-color` n'a pas besoin de la protection
   * `commitStyles`/WAAPI (Angular n'y touche jamais) mais s'anime mal en
   * keyframes WAAPI, d'où une transition CSS dédiée, en parallèle, ciblant
   * uniquement cette propriété.
   */
  private resetBorderColorToGray(ball: HTMLElement, color: string, durationMs: number, easing: string): void {
    ball.style.borderLeftColor = color;
    ball.style.transition = 'none';
    ball.style.borderTopColor = color;
    ball.style.borderRightColor = color;
    ball.style.borderBottomColor = color;
    void ball.offsetHeight; // flush layout/style avant de réactiver la transition
    ball.style.transition = `border-color ${durationMs}ms ${easing}`;
    ball.style.borderTopColor = THUMB_BORDER_GRAY;
    ball.style.borderRightColor = THUMB_BORDER_GRAY;
    ball.style.borderBottomColor = THUMB_BORDER_GRAY;
  }

  /**
   * Phase 2 : la miniature s'arrondit en bulle en voyageant vers le doigt.
   * Contrairement à un WAAPI figé sur la position du doigt au moment T, cette
   * boucle relit `pointer()` À CHAQUE FRAME : si le doigt continue de bouger
   * pendant que la bulle se forme, la trajectoire s'infléchit en direct au
   * lieu de foncer vers un point déjà obsolète à l'arrivée.
   */
  private playTravelFollow(
    ball: HTMLElement,
    startLeft: number,
    startTop: number,
    startWidth: number,
    startHeight: number,
  ): void {
    const startTime = performance.now();

    const step = (now: number) => {
      if (this.phase() !== 'lifted') {
        this.travelFollowLoop = undefined;
        return;
      }

      const t = Math.min(1, (now - startTime) / BALL_TRAVEL_DURATION);
      const eased = 1 - Math.pow(1 - t, 3); // proche du cubic-bezier(0.22, 1, 0.36, 1) d'origine
      const target = this.dispatchService.pointer();

      const width = lerp(startWidth, BALL_SIZE, eased);
      const height = lerp(startHeight, BALL_SIZE, eased);
      const left = lerp(startLeft, target.x - BALL_SIZE / 2, eased);
      const top = lerp(startTop, target.y - BALL_SIZE / 2, eased);

      ball.style.width = `${width}px`;
      ball.style.height = `${height}px`;
      ball.style.transform = `translate3d(${left}px, ${top}px, 0)`;
      ball.style.borderRadius = `${lerp(THUMB_BORDER_RADIUS_PX, BALL_SIZE / 2, eased)}px`;
      ball.style.borderTopWidth = `${lerp(THUMB_BORDER_THIN_PX, BALL_BORDER_WIDTH_PX, eased)}px`;
      ball.style.borderRightWidth = `${lerp(THUMB_BORDER_THIN_PX, BALL_BORDER_WIDTH_PX, eased)}px`;
      ball.style.borderBottomWidth = `${lerp(THUMB_BORDER_THIN_PX, BALL_BORDER_WIDTH_PX, eased)}px`;
      ball.style.borderLeftWidth = `${lerp(THUMB_BORDER_LEFT_PX, BALL_BORDER_WIDTH_PX, eased)}px`;

      if (t >= 1) {
        this.travelFollowLoop = undefined;
        this.formed.set(true);
        return;
      }
      this.travelFollowLoop = requestAnimationFrame(step);
    };

    this.travelFollowLoop = requestAnimationFrame(step);
  }

  private stopTravelFollow(): void {
    if (this.travelFollowLoop) {
      cancelAnimationFrame(this.travelFollowLoop);
      this.travelFollowLoop = undefined;
    }
  }

  private playDropAnimation(): void {
    const ball = this.ballRef()?.nativeElement;
    const targetRect = this.dispatchService.hoveredDayRect();
    if (!ball || !targetRect) {
      this.dispatchService.finish();
      return;
    }

    this.formed.set(false);
    this.stopTravelFollow();
    const current = ball.getBoundingClientRect();
    const targetX = targetRect.left + targetRect.width / 2 - BALL_SIZE / 2;
    const targetY = targetRect.top + targetRect.height / 2 - BALL_SIZE / 2;

    this.currentBallAnimation?.cancel();
    this.currentBallAnimation = ball.animate(
      [
        { transform: `translate3d(${current.left}px, ${current.top}px, 0)`, opacity: 1 },
        { transform: `translate3d(${targetX}px, ${targetY}px, 0) scale(0.15)`, opacity: 0 },
      ],
      { duration: DROP_DURATION, easing: 'ease-in', fill: 'forwards' },
    );
    this.currentBallAnimation.finished
      .then(() => {
        this.sheetExpanded.set(false);
        this.finishAfterSheetClose(DROP_DURATION);
      })
      .catch(() => {
        /* animation annulée (ex. drag suivant démarré avant la fin) : rien à faire */
      });
  }

  /**
   * Attend la fermeture CSS du calendrier (même durée dynamique que
   * l'ouverture, cf. `expandDurationMs`) avant d'appeler `finish()` : sinon
   * `finish()` bascule `isVisible` à `false` — donc le sheet en
   * `display: none` — pendant que la réplique/la grille sont encore en train
   * de s'animer, ce qui les coupe net au lieu de les laisser finir.
   * `alreadyElapsedMs` est la durée déjà écoulée en parallèle de cette
   * fermeture CSS (l'animation de la bulle elle-même) — voir les deux
   * appelants (`playDropAnimation`/`playReturnAnimation`) pour leur calcul
   * respectif.
   */
  private finishAfterSheetClose(alreadyElapsedMs: number): void {
    const cssCloseRemaining = Math.max(0, this.expandDurationMs() - alreadyElapsedMs);
    if (cssCloseRemaining > 0) {
      setTimeout(() => this.dispatchService.finish(), cssCloseRemaining);
    } else {
      this.dispatchService.finish();
    }
  }

  /** Retour "aimant" : trajet inverse (bulle -> miniature) puis redéploiement du texte. */
  private playReturnAnimation(): void {
    const ball = this.ballRef()?.nativeElement;
    const origin = this.dispatchService.originRect();
    if (!ball || !origin) {
      this.dispatchService.finish();
      return;
    }

    this.formed.set(false);
    this.stopTravelFollow();
    const current = ball.getBoundingClientRect();
    const { width: collapsedWidth, height: collapsedHeight } = this.ballContentService.computeCollapsedSize(origin);
    const collapsedLeft = origin.left;
    const collapsedTop = origin.top + (origin.height - collapsedHeight) / 2;
    const color = this.dragged()?.color ?? 'var(--nt-primary-color)';

    // `transform` DOIT rester piloté par WAAPI ici, pas par une simple
    // affectation de style : dès `this.formed.set(false)` ci-dessus, le
    // binding du template `[style.transform]="formed() ? ballTransform() :
    // null"` remet cette propriété à `null` au prochain cycle de détection de
    // changements. Un effet WAAPI actif prévaut sur cette remise à zéro (il
    // se compose par-dessus la valeur spécifiée) ; un style inline brut, lui,
    // se ferait immédiatement écraser par le `null` d'Angular — c'est ce qui
    // faisait sauter la bulle en haut à gauche de l'écran (transform perdu).
    this.currentBallAnimation?.cancel();
    const travelBackAnim = ball.animate(
      [
        {
          transform: `translate3d(${current.left}px, ${current.top}px, 0)`,
          width: `${BALL_SIZE}px`,
          height: `${BALL_SIZE}px`,
          borderRadius: '50%',
          borderTopWidth: `${BALL_BORDER_WIDTH_PX}px`,
          borderRightWidth: `${BALL_BORDER_WIDTH_PX}px`,
          borderBottomWidth: `${BALL_BORDER_WIDTH_PX}px`,
          borderLeftWidth: `${BALL_BORDER_WIDTH_PX}px`,
        },
        {
          transform: `translate3d(${collapsedLeft}px, ${collapsedTop}px, 0)`,
          width: `${collapsedWidth}px`,
          height: `${collapsedHeight}px`,
          borderRadius: `${THUMB_BORDER_RADIUS_PX}px`,
          borderTopWidth: `${THUMB_BORDER_THIN_PX}px`,
          borderRightWidth: `${THUMB_BORDER_THIN_PX}px`,
          borderBottomWidth: `${THUMB_BORDER_THIN_PX}px`,
          borderLeftWidth: `${THUMB_BORDER_LEFT_PX}px`,
        },
      ],
      { duration: RETURN_TRAVEL_DURATION, easing: 'cubic-bezier(0.34, 1.2, 0.64, 1)', fill: 'forwards' },
    );
    this.currentBallAnimation = travelBackAnim;

    this.resetBorderColorToGray(ball, color, RETURN_TRAVEL_DURATION, 'ease');

    travelBackAnim.finished
      .then(() => {
        if (this.phase() !== 'returning') return;
        // La miniature redevient un item fixe de la ligne (3rem) avant que
        // celle-ci ne se redéploie, sinon elle resterait "en remplissage"
        // pendant que le conteneur reprend sa largeur d'origine.
        this.thumbFilled.set(false);
        // Même piège que documenté historiquement ici : sans `.commitStyles()`
        // avant ce `.cancel()`, `travelBackAnim` (fill: 'forwards') perdrait
        // instantanément taille/rayon/épaisseur de bord en repassant au style
        // spécifié sous-jacent dès son annulation — `commitStyles()` fige
        // d'abord son dernier état dans le style inline pour que rien ne se
        // perde visuellement.
        travelBackAnim.commitStyles();
        travelBackAnim.cancel();
        const expandAnim = ball.animate(
          [
            {
              transform: `translate3d(${collapsedLeft}px, ${collapsedTop}px, 0)`,
              width: `${collapsedWidth}px`,
              height: `${collapsedHeight}px`,
            },
            {
              transform: `translate3d(${origin.left}px, ${origin.top}px, 0)`,
              width: `${origin.width}px`,
              height: `${origin.height}px`,
            },
          ],
          { duration: RETURN_EXPAND_DURATION, easing: 'ease-in-out', fill: 'forwards' },
        );
        this.currentBallAnimation = expandAnim;
        // En parallèle, même durée/easing : poignée/texte réapparaissent
        // dans le même mouvement que la carte se réélargit (voir
        // expandBallContent) — pas après coup.
        const returnContent = this.ballContentRef()?.nativeElement;
        if (returnContent) this.ballContentService.expandBallContent(returnContent, RETURN_EXPAND_DURATION);

        expandAnim.finished
          .then(() => {
            // Même raison que dans `playDropAnimation` : `sheetExpanded` est
            // passé à `false` dès le début de la phase 'returning' (voir le
            // constructeur), donc la fermeture CSS du calendrier tourne déjà
            // en parallèle du retour de la bulle — mais sa durée dynamique
            // (`expandDurationMs`) dépasse maintenant celle, fixe, de la
            // bulle. On complète l'attente avant `finish()` pour ne pas
            // couper la réplique/la grille en plein milieu de leur retour.
            this.finishAfterSheetClose(RETURN_TRAVEL_DURATION + RETURN_EXPAND_DURATION);
          })
          .catch(() => {
            /* animation annulée : rien à faire */
          });
      })
      .catch(() => {
        /* animation annulée : rien à faire */
      });
  }

  /**
   * Désescalade (jour) : même structure en 2 phases que `playReturnAnimation`
   * (bulle -> miniature, PUIS miniature -> pleine taille pour révéler
   * poignée/texte), sauf que tout se joue SUR PLACE (aucune position
   * d'origine fixe n'a de sens ici, le drag sous-jacent a continué de bouger
   * pendant l'escalade) — puis la bulle s'efface d'un coup, pendant que le
   * clone qui suit le doigt redevient visible au même endroit dès que
   * `dayEscalated()` repasse à `false` (voir l'effect() dans
   * DayPanelComponent). Une PREMIÈRE version s'arrêtait à la phase 1 (juste
   * les bords qui basculent, jamais de réélargissement) : ne JAMAIS revenir
   * à une seule phase ici, le réélargissement est ce qui rend le redéploiement
   * visible.
   */
  private playDeescalateAnimation(): void {
    const ball = this.ballRef()?.nativeElement;
    const origin = this.dispatchService.originRect();
    if (!ball || !origin) {
      this.dispatchService.finish();
      return;
    }

    this.formed.set(false);
    this.thumbFilled.set(false);
    this.stopTravelFollow();
    const current = ball.getBoundingClientRect();
    const { width: collapsedWidth, height: collapsedHeight } = this.ballContentService.computeCollapsedSize(origin);
    const pos = `translate3d(${current.left}px, ${current.top}px, 0)`;
    const color = this.dragged()?.color ?? 'var(--nt-primary-color)';

    // `transform` DOIT rester piloté par WAAPI (même s'il ne change pas de
    // valeur ici, "SUR PLACE") : dès `this.formed.set(false)` ci-dessus, le
    // binding du template `[style.transform]="formed() ? ballTransform() :
    // null"` le remet à `null` au prochain cycle de détection de
    // changements. Un effet WAAPI actif prévaut sur cette remise à zéro ; une
    // simple affectation de style se ferait écraser par ce `null`, ce qui
    // faisait sauter la bulle en haut à gauche de l'écran (transform perdu).
    // Pas d'`opacity` dans ces keyframes : la bulle doit rester pleinement
    // visible pendant TOUT le redéploiement en carte, pour qu'on voie
    // réellement la forme changer. Elle disparaît d'un coup, INSTANTANÉMENT,
    // seulement une fois `finish()` appelé (retrait de `.dispatch-ball--active`,
    // sans transition CSS dessus) — au même moment où le clone qui suit le
    // doigt redevient visible (voir l'effect() dans DayPanelComponent), pas
    // en fondu pendant l'animation elle-même (ce qui la rendait quasi
    // invisible avant même la fin du redéploiement).
    this.currentBallAnimation?.cancel();
    const shrinkAnim = ball.animate(
      [
        {
          transform: pos,
          width: `${BALL_SIZE}px`,
          height: `${BALL_SIZE}px`,
          borderRadius: '50%',
          borderTopWidth: `${BALL_BORDER_WIDTH_PX}px`,
          borderRightWidth: `${BALL_BORDER_WIDTH_PX}px`,
          borderBottomWidth: `${BALL_BORDER_WIDTH_PX}px`,
          borderLeftWidth: `${BALL_BORDER_WIDTH_PX}px`,
        },
        {
          transform: pos,
          width: `${collapsedWidth}px`,
          height: `${collapsedHeight}px`,
          borderRadius: `${THUMB_BORDER_RADIUS_PX}px`,
          borderTopWidth: `${THUMB_BORDER_THIN_PX}px`,
          borderRightWidth: `${THUMB_BORDER_THIN_PX}px`,
          borderBottomWidth: `${THUMB_BORDER_THIN_PX}px`,
          borderLeftWidth: `${THUMB_BORDER_LEFT_PX}px`,
        },
      ],
      { duration: DAY_DRAG_COLLAPSE_DURATION_MS, easing: 'ease-in-out', fill: 'forwards' },
    );
    this.currentBallAnimation = shrinkAnim;

    this.resetBorderColorToGray(ball, color, DAY_DRAG_COLLAPSE_DURATION_MS, 'ease-in-out');

    shrinkAnim.finished
      .then(() => {
        if (this.phase() !== 'deescalating') return;
        // Même piège que `playReturnAnimation` : sans `commitStyles()` avant
        // ce `cancel()`, `shrinkAnim` (fill: 'forwards') perdrait
        // instantanément taille/rayon/épaisseur de bord en repassant au style
        // spécifié sous-jacent dès son annulation.
        shrinkAnim.commitStyles();
        shrinkAnim.cancel();

        // Phase 2, absente d'une première version de ce correctif (d'où la
        // bulle qui ne faisait que basculer ses bords sans jamais se
        // rouvrir) : la miniature se réélargit jusqu'à la taille pleine de
        // la carte d'origine, SUR PLACE — symétrique de `expandAnim` dans
        // `playReturnAnimation`. Poignée/texte suivent tout seuls (voir
        // styles.scss : ils peuvent rétrécir jusqu'à 0, contrairement à leur
        // contexte carte normale) — pas de classe à retirer ici.
        const expandAnim = ball.animate(
          [
            { transform: pos, width: `${collapsedWidth}px`, height: `${collapsedHeight}px` },
            { transform: pos, width: `${origin.width}px`, height: `${origin.height}px` },
          ],
          { duration: DAY_DRAG_EXPAND_DURATION_MS, easing: 'ease-in-out', fill: 'forwards' },
        );
        this.currentBallAnimation = expandAnim;
        // Même remarque que dans playReturnAnimation : synchronisé, pas
        // séquentiel (voir expandBallContent) — c'est précisément ce qui
        // manquait ici (la photo se décalait seule avant que la carte ne
        // s'élargisse).
        const deescalateContent = this.ballContentRef()?.nativeElement;
        if (deescalateContent) this.ballContentService.expandBallContent(deescalateContent, DAY_DRAG_EXPAND_DURATION_MS);

        expandAnim.finished
          .then(() => this.dispatchService.finish())
          .catch(() => {
            /* animation annulée : rien à faire */
          });
      })
      .catch(() => {
        /* animation annulée : rien à faire */
      });
  }
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
