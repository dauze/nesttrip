import { CommonModule } from '@angular/common';
import {
  Component, ElementRef, computed, effect, inject, input, signal, untracked, viewChild, viewChildren
} from '@angular/core';
import { Button } from 'primeng/button';
import { TabsModule } from 'primeng/tabs';
import { Day } from '@app/features/trips/trip.model';
import { TripTab } from '@app/features/trips/trip-detail/trip-tab.model';
import { TripFacade } from '@app/features/trips/trip-facade.service';
import { ActivityDispatchService } from '@app/core/services/activity-dispatch.service';
import { GooglePhotoService } from '@app/core/services/google-photo.service';

interface MonthGroup {
  label: string;
  days: Day[];
}

// ── Constantes d'animation ───────────────────────────────────────────────
// Volontairement lentes pour l'instant (validation du comportement) :
// à accélérer une fois le mécanisme approuvé.
const BALL_SIZE = 56;
/** Phase 1 de la formation de la bulle : le texte se tasse depuis la droite. */
const TEXT_COLLAPSE_DURATION = 550;
/** Phase 2 : la bulle voyage vers le doigt en s'arrondissant, le contour l'enveloppe. */
const BALL_TRAVEL_DURATION = 700;
const DROP_DURATION = 550;
/** Retour "aimant" : trajet inverse puis redéploiement du texte. */
const RETURN_TRAVEL_DURATION = 700;
const RETURN_EXPAND_DURATION = 550;
/** Délai doigt-hors-zone avant rétractation du calendrier. */
const OUTSIDE_HIDE_DELAY = 550;
/** Zone basse de l'écran qui redéploie le calendrier rétracté. */
const NEAR_BOTTOM_REOPEN_PX = 110;
const EDGE_SCROLL_ZONE = 56;
const EDGE_SCROLL_SPEED = 8;
/** FLIP des onglets de jours visibles vers leur bouton de grille correspondant. */
const TAB_FLIP_DURATION = 700;
/** Distance (px) sous laquelle le doigt est considéré comme immobile. */
const STATIONARY_TOLERANCE_PX = 4;
/** Rayon/épaisseurs de bordure de la miniature (phase 2, point de départ) et de la bulle (point d'arrivée), en px. */
const THUMB_BORDER_RADIUS_PX = 12;
const THUMB_BORDER_LEFT_PX = 6.4; // 0.4rem
const BALL_BORDER_WIDTH_PX = 3;

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

@Component({
  selector: 'app-activity-day-dispatch-overlay',
  standalone: true,
  imports: [CommonModule, Button, TabsModule],
  templateUrl: './activity-day-dispatch-overlay.component.html',
  styleUrl: './activity-day-dispatch-overlay.component.scss',
})
export class ActivityDayDispatchOverlayComponent {
  protected readonly dispatchService = inject(ActivityDispatchService);
  private readonly tripFacade = inject(TripFacade);
  private readonly googlePhotoService = inject(GooglePhotoService);

  readonly days = input<Day[]>([]);
  /** Mêmes onglets que app-trip-tabs-nav (Général + jours), pour en afficher une réplique identique au repos. */
  readonly tabs = input<TripTab[]>([]);
  /** Jour (ou 'notes') actuellement visible dans le swiper, utilisé comme zone de dépose de secours quand le calendrier est rétracté. */
  readonly activeDayId = input<string>('');

  private readonly sheetRef = viewChild<ElementRef<HTMLElement>>('sheet');
  private readonly gridRef = viewChild<ElementRef<HTMLElement>>('grid');
  private readonly ballRef = viewChild<ElementRef<HTMLElement>>('ball');
  private readonly replicaNavRef = viewChild<ElementRef<HTMLElement>>('replicaNav');
  // `read: ElementRef` est indispensable ici : ces éléments portent des
  // composants PrimeNG (`p-button`/`p-tab`), donc sans lui, la référence
  // résout vers l'instance du composant (pas d'`.nativeElement`) et non vers
  // l'élément DOM — c'est ce qui provoquait le crash "Cannot read properties
  // of undefined (reading 'dataset')".
  private readonly cellRefs = viewChildren('dayCell', { read: ElementRef<HTMLElement> });
  private readonly replicaTabRefs = viewChildren('replicaTab', { read: ElementRef<HTMLElement> });

  protected readonly dragged = this.dispatchService.dragged;
  protected readonly phase = this.dispatchService.phase;
  protected readonly hoveredDayKey = this.dispatchService.hoveredDayKey;

  /** true une fois la bulle "formée" : à partir de là elle suit le pointeur en direct via binding, plus de WAAPI. */
  protected readonly formed = signal(false);
  /** true une fois le texte tassé (fin de la phase 1) : la miniature quitte le flux et remplit toute la bulle (phase 2). */
  protected readonly thumbFilled = signal(false);
  /** true une fois le calendrier pleinement déployé (morph terminé) : gouverne désormais son affichage par CSS simple. */
  protected readonly sheetExpanded = signal(false);
  /** true quand le doigt est sorti de la zone du calendrier depuis assez longtemps : le calendrier se rétracte pour laisser déposer directement sur le jour visible. */
  protected readonly retracted = signal(false);
  /** Hauteur exacte (px) de la vraie barre d'onglets, mesurée à chaque décrochage : permet au clone de la superposer au pixel près avant de grandir. */
  protected readonly collapsedHeight = signal(56);
  /** Clés des jours dont l'onglet de la barre repliée est en train de "devenir" le bouton de la grille (FLIP) : l'onglet d'origine s'efface pendant que le bouton anime depuis sa position. */
  protected readonly flippedDayIds = signal<ReadonlySet<string>>(new Set());

  protected readonly monthGroups = computed<MonthGroup[]>(() => this.groupByMonth(this.days()));

  protected readonly countsByDay = computed(() => {
    const map = new Map<string, number>();
    for (const day of this.days()) {
      map.set(this.dayKeyFor(day), this.tripFacade.getActivities(day.id)().length);
    }
    return map;
  });

  protected readonly ballTransform = computed(() => {
    const p = this.dispatchService.pointer();
    return `translate3d(${p.x - BALL_SIZE / 2}px, ${p.y - BALL_SIZE / 2}px, 0)`;
  });

  private currentBallAnimation?: Animation;
  private travelFollowLoop?: number;
  private currentTabFlipAnimations: Animation[] = [];
  private edgeScrollLoop?: number;
  private outsideTimer?: ReturnType<typeof setTimeout>;
  private sheetTransitionListenerBound = false;

  constructor() {
    // La demande de dispatch réelle est émise par le service ; c'est ici,
    // dans un contexte qui a accès au TripFacade (fourni au niveau de la
    // route trips), qu'on l'exécute réellement contre le store.
    effect(() => {
      const req = this.dispatchService.dropRequested();
      if (!req) return;
      this.tripFacade.dispatchActivity(req.tripId, req.activityId, new Date(req.dayKey));
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
          this.retracted.set(false);
          this.playFormAnimation();
          this.openSheet();
          this.startEdgeAutoScroll();
        } else if (phase === 'dropping') {
          this.stopEdgeAutoScroll();
          this.clearOutsideTimer();
          this.sheetExpanded.set(false);
          this.cancelTabFlip();
          this.playDropAnimation();
        } else if (phase === 'returning') {
          this.stopEdgeAutoScroll();
          this.clearOutsideTimer();
          this.sheetExpanded.set(false);
          this.cancelTabFlip();
          this.playReturnAnimation();
        }
      });
    });

    // Surveille en direct la position du doigt pour la rétractation du
    // calendrier — celui-ci DOIT réagir en continu, donc pas d'`untracked` ici.
    effect(() => {
      const pointer = this.dispatchService.pointer();
      if (this.phase() === 'lifted' && this.sheetExpanded()) {
        this.checkOutsideSheet(pointer);
      }
    });
  }

  protected dayKeyFor(day: Day): string {
    return day.id.toISOString();
  }

  protected photoUrl$(ref: string) {
    return this.googlePhotoService.getPhotoUrl$(ref, 160);
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

  // ── Rétractation quand le doigt s'éloigne du calendrier ───────────────────

  private checkOutsideSheet(pointer: { x: number; y: number }): void {
    if (this.retracted()) {
      if (pointer.y > window.innerHeight - NEAR_BOTTOM_REOPEN_PX) {
        this.clearOutsideTimer();
        this.expandSheet();
      }
      return;
    }

    const sheetRect = this.sheetRef()?.nativeElement.getBoundingClientRect();
    const inside = !!sheetRect &&
      pointer.x >= sheetRect.left && pointer.x <= sheetRect.right &&
      pointer.y >= sheetRect.top - 32 && pointer.y <= sheetRect.bottom;

    if (inside) {
      this.clearOutsideTimer();
      return;
    }

    if (!this.outsideTimer) {
      const pointerAtStart = pointer;
      this.outsideTimer = setTimeout(() => {
        this.outsideTimer = undefined;

        // Sur le pool général (aucun jour "source" d'où l'activité viendrait),
        // si le doigt est resté immobile hors du calendrier, on ne le replie
        // pas sous les yeux de l'utilisateur — il hésite probablement plutôt
        // que d'avoir renoncé au geste.
        const current = this.dispatchService.pointer();
        const stayedStill = Math.hypot(current.x - pointerAtStart.x, current.y - pointerAtStart.y) <= STATIONARY_TOLERANCE_PX;
        if (stayedStill && this.activeDayId() === 'notes') return;

        this.retractSheet();
      }, OUTSIDE_HIDE_DELAY);
    }
  }

  private clearOutsideTimer(): void {
    if (this.outsideTimer) {
      clearTimeout(this.outsideTimer);
      this.outsideTimer = undefined;
    }
  }

  private retractSheet(): void {
    this.retracted.set(true);
    // Le jour actuellement visible dans le swiper devient l'unique cible de dépose.
    const rect = this.dispatchService.getDayViewRect();
    const activeId = this.activeDayId();
    if (rect && activeId) {
      this.dispatchService.registerDayCells(new Map([[activeId, rect]]));
    } else {
      this.dispatchService.registerDayCells(new Map());
    }
  }

  private expandSheet(): void {
    this.retracted.set(false);
    requestAnimationFrame(() => this.captureCellRects());
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
      if (grid && this.sheetExpanded() && !this.retracted()) {
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
    const navRect = this.dispatchService.getNavBarRect();
    if (navRect) this.collapsedHeight.set(navRect.height);

    // Les onglets de jours actuellement visibles dans la barre repliée
    // doivent être mesurés MAINTENANT, avant que quoi que ce soit ne bouge :
    // c'est leur position/taille de départ pour le FLIP qui les transforme
    // en boutons de la grille.
    const flipTargets = this.captureVisibleTabFlipTargets();
    this.flippedDayIds.set(new Set(flipTargets.keys()));

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
          this.runTabFlip(flipTargets);
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

  // ── FLIP des onglets de jours visibles vers les boutons de la grille ─────
  //
  // Les onglets déjà visibles dans la barre repliée (hors "Général") ne se
  // contentent pas d'apparaître en dessous : ils "deviennent" littéralement
  // le bouton correspondant de la grille — même technique FLIP que la bulle
  // (mesurer avant, mesurer après, WAAPI entre les deux), appliquée ici à
  // chaque bouton concerné plutôt qu'à un clone unique.

  private captureVisibleTabFlipTargets(): Map<string, DOMRect> {
    const map = new Map<string, DOMRect>();
    const nav = this.replicaNavRef()?.nativeElement;
    if (!nav) return map;

    const navRect = nav.getBoundingClientRect();
    const tabEls = this.replicaTabRefs();
    const tabsList = this.tabs();

    // i = 0 est "Général" : il part vers la gauche, il ne "devient" rien.
    for (let i = 1; i < tabEls.length; i++) {
      const tab = tabsList[i];
      const el = tabEls[i]?.nativeElement;
      if (!tab || !el) continue;
      const rect = el.getBoundingClientRect();
      const isVisible = rect.width > 0 && rect.right > navRect.left && rect.left < navRect.right;
      if (!isVisible) continue;
      map.set(tab.id, rect);
    }
    return map;
  }

  private runTabFlip(targets: Map<string, DOMRect>): void {
    this.stopTabFlipAnimations();
    if (targets.size === 0) return;

    for (const cell of this.cellRefs()) {
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
  private cancelTabFlip(): void {
    this.stopTabFlipAnimations();
    this.flippedDayIds.set(new Set());
  }

  // ── Formation / voyage / retour de la bulle ────────────────────────────────

  /**
   * Séquence complète de formation, en deux temps comme demandé :
   *  1. Le header (identique à la carte) se tasse depuis la droite : le
   *     texte et la poignée s'effacent, ne reste que la miniature.
   *  2. Cette miniature voyage vers le doigt en s'arrondissant en bulle, le
   *     bord gauche coloré s'étirant pour en faire le tour.
   */
  private playFormAnimation(): void {
    const ball = this.ballRef()?.nativeElement;
    const origin = this.dispatchService.originRect();
    if (!ball || !origin) return;

    this.formed.set(false);
    this.thumbFilled.set(false);
    this.currentBallAnimation?.cancel();
    this.stopTravelFollow();

    const thumbSize = Math.min(origin.height, 48);
    // Une fois le texte tassé, plus aucune marge interne (cf. scss
    // `--collapsed`) : le conteneur se réduit exactement à la taille de la
    // miniature, qui passera ensuite en mode "remplissage total".
    const collapsedWidth = thumbSize;
    const collapsedLeft = origin.left;
    const collapsedTop = origin.top + (origin.height - thumbSize) / 2;

    ball.classList.add('dispatch-ball--collapsing');

    const collapseAnim = ball.animate(
      [
        {
          transform: `translate3d(${origin.left}px, ${origin.top}px, 0)`,
          width: `${origin.width}px`,
          height: `${origin.height}px`,
        },
        {
          transform: `translate3d(${collapsedLeft}px, ${collapsedTop}px, 0)`,
          width: `${collapsedWidth}px`,
          height: `${thumbSize}px`,
        },
      ],
      { duration: TEXT_COLLAPSE_DURATION, easing: 'ease-in-out', fill: 'forwards' },
    );
    this.currentBallAnimation = collapseAnim;

    collapseAnim.finished
      .then(() => {
        if (this.phase() !== 'lifted') return;
        // La miniature quitte le flux et remplit désormais exactement le
        // conteneur, quelle que soit sa taille à chaque instant de la phase 2
        // (transition CSS, pas de calcul JS supplémentaire nécessaire).
        this.thumbFilled.set(true);
        // `fill: 'forwards'` maintient l'effet de `collapseAnim` "en vigueur"
        // même une fois `.finished` résolu : tant qu'elle n'est pas annulée,
        // son dernier keyframe (position/tailles au moment du tassement)
        // continue de primer sur toute manipulation directe de `ball.style`
        // faite ensuite — symptôme observé : la bulle reste figée à l'endroit
        // du tassement, `playTravelFollow` (ci-dessous) et le binding
        // `[style.transform]` une fois `formed()` n'ayant alors plus aucun
        // effet visible.
        collapseAnim.cancel();
        this.currentBallAnimation = undefined;
        this.playTravelFollow(ball, collapsedLeft, collapsedTop, collapsedWidth, thumbSize);
      })
      .catch(() => {
        /* animation annulée : une transition drop/return a déjà pris le relais */
      });
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
      ball.style.borderTopWidth = `${lerp(0, BALL_BORDER_WIDTH_PX, eased)}px`;
      ball.style.borderRightWidth = `${lerp(0, BALL_BORDER_WIDTH_PX, eased)}px`;
      ball.style.borderBottomWidth = `${lerp(0, BALL_BORDER_WIDTH_PX, eased)}px`;
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
        ball.classList.remove('dispatch-ball--collapsing');
        this.dispatchService.finish();
      })
      .catch(() => {
        /* animation annulée (ex. drag suivant démarré avant la fin) : rien à faire */
      });
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
    const thumbSize = Math.min(origin.height, 48);
    const collapsedWidth = thumbSize;
    const collapsedLeft = origin.left;
    const collapsedTop = origin.top + (origin.height - thumbSize) / 2;

    this.currentBallAnimation?.cancel();
    const travelBackAnim = ball.animate(
      [
        {
          transform: `translate3d(${current.left}px, ${current.top}px, 0)`,
          width: `${BALL_SIZE}px`,
          height: `${BALL_SIZE}px`,
          borderRadius: '50%',
          borderTopWidth: '3px',
          borderRightWidth: '3px',
          borderBottomWidth: '3px',
          borderLeftWidth: '3px',
        },
        {
          transform: `translate3d(${collapsedLeft}px, ${collapsedTop}px, 0)`,
          width: `${collapsedWidth}px`,
          height: `${thumbSize}px`,
          borderRadius: '12px',
          borderTopWidth: '0px',
          borderRightWidth: '0px',
          borderBottomWidth: '0px',
          borderLeftWidth: '0.4rem',
        },
      ],
      { duration: RETURN_TRAVEL_DURATION, easing: 'cubic-bezier(0.34, 1.2, 0.64, 1)', fill: 'forwards' },
    );
    this.currentBallAnimation = travelBackAnim;

    travelBackAnim.finished
      .then(() => {
        if (this.phase() !== 'returning') return;
        // La miniature redevient un item fixe de la ligne (3rem) avant que
        // celle-ci ne se redéploie, sinon elle resterait "en remplissage"
        // pendant que le conteneur reprend sa largeur d'origine.
        this.thumbFilled.set(false);
        // Même piège que pour `collapseAnim` (voir plus haut) : sans ce
        // `.cancel()`, `travelBackAnim` (fill: 'forwards') reste active en
        // arrière-plan une fois `expandAnim` démarrée. Elle est bien
        // supplantée tant qu'`expandAnim` existe (composite order WAAPI),
        // mais dès que `currentBallAnimation` (= expandAnim) est annulée au
        // drag suivant, `travelBackAnim` — jamais annulée — reprend la main
        // et fige la bulle sur la position du doigt au relâchement précédent.
        travelBackAnim.cancel();
        const expandAnim = ball.animate(
          [
            {
              transform: `translate3d(${collapsedLeft}px, ${collapsedTop}px, 0)`,
              width: `${collapsedWidth}px`,
              height: `${thumbSize}px`,
            },
            {
              transform: `translate3d(${origin.left}px, ${origin.top}px, 0)`,
              width: `${origin.width}px`,
              height: `${origin.height}px`,
            },
          ],
          { duration: RETURN_EXPAND_DURATION, easing: 'ease-in-out', fill: 'forwards' },
        );
        ball.classList.remove('dispatch-ball--collapsing');
        this.currentBallAnimation = expandAnim;

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
