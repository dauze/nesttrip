import { CommonModule } from '@angular/common';
import {
  Component, ElementRef, computed, effect, inject, input, signal, untracked, viewChild, viewChildren
} from '@angular/core';
import { Button } from 'primeng/button';
import { TabsModule } from 'primeng/tabs';
import { Day } from '@app/features/trips/trip.model';
import { TripTab } from '@app/features/trips/trip-detail/trip-tab.model';
import { TripFacade } from '@app/features/trips/trip-facade.service';
import { ActivityDispatchService, DraggedActivityInfo } from '@app/core/services/activity-dispatch.service';
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
const TEXT_COLLAPSE_DURATION = 250;
/** Phase 2 : la bulle voyage vers le doigt en s'arrondissant, le contour l'enveloppe. */
const BALL_TRAVEL_DURATION = 300;
const DROP_DURATION = 250;
/** Retour "aimant" (pool uniquement) : trajet inverse vers la carte d'origine puis redéploiement du texte. */
const RETURN_TRAVEL_DURATION = 300;
const RETURN_EXPAND_DURATION = 250;
/** Délai doigt-hors-calendrier avant désescalade d'un geste jour (voir `checkLeaveSheet`). */
const LEAVE_SHEET_DELAY_MS = 250;
/** Durée de survol continu de la barre repliée avant d'escalader un cdkDrag en cours vers le calendrier de dispatch. */
const DAY_DRAG_ESCALATE_HOVER_MS = 450;
/** Désescalade (jour) : la bulle se redéploie en forme de carte sur place puis s'efface, sans translation vers une origine devenue obsolète. */
const DAY_DRAG_COLLAPSE_DURATION_MS = 350;
const EDGE_SCROLL_ZONE = 56;
const EDGE_SCROLL_SPEED = 8;
/** FLIP des onglets de jours visibles vers leur bouton de grille correspondant. */
const TAB_FLIP_DURATION = 300;
/**
 * Durée de la "montée" du calendrier (croissance du sheet, effacement de la
 * réplique, apparition de la grille) : les trois animations partagent cette
 * même durée, calculée à chaque décrochage à partir de la distance réelle
 * (px) parcourue par le sheet, pour rester à vitesse constante quelle que
 * soit la hauteur d'écran — sans quoi un grand écran (plus de px à parcourir
 * en 50vh) ferait paraître le morph plus rapide qu'un petit.
 */
const EXPAND_DURATION_BASE_MS = 200;
const EXPAND_DURATION_PX_FACTOR_MS = 1.1;
const EXPAND_DURATION_MIN_MS = 500;
const EXPAND_DURATION_MAX_MS = 1100;
/** Doit rester synchronisé avec `max-height: 50vh` sur `.dispatch-overlay--expanded .dispatch-overlay__sheet` (scss). */
const EXPANDED_HEIGHT_VH_RATIO = 0.5;
/** Rayon/épaisseurs de bordure de la miniature (phase 2, point de départ) et de la bulle (point d'arrivée), en px. */
const THUMB_BORDER_RADIUS_PX = 12;
const THUMB_BORDER_LEFT_PX = 6.4; // 0.4rem
/** Épaisseur du fin liseré gris (haut/droite/bas) au repos, identique à celle de l'activity-header (bordure p-panel par défaut). */
const THUMB_BORDER_THIN_PX = 1;
/** Variable CSS du liseré gris de l'activity-header (voir `.booking` dans activity-card.component.scss). */
const THUMB_BORDER_GRAY = 'var(--p-content-border-color)';
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
  /** Hauteur exacte (px) de la vraie barre d'onglets, mesurée à chaque décrochage : permet au clone de la superposer au pixel près avant de grandir. */
  protected readonly collapsedHeight = signal(56);
  /** Durée (ms) partagée par la croissance du sheet, l'effacement de la réplique et la montée de la grille — voir `EXPAND_DURATION_BASE_MS`. */
  protected readonly expandDurationMs = signal(700);
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
  /** Délai avant désescalade quand le doigt quitte le calendrier pendant un geste jour déjà escaladé (voir `checkLeaveSheet`). */
  private leaveTimer?: ReturnType<typeof setTimeout>;
  /** Survol continu de la barre repliée avant escalade d'un cdkDrag en cours (voir `checkEscalate`). */
  private escalateTimer?: ReturnType<typeof setTimeout>;
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
          this.playFormAnimation();
          this.openSheet();
          this.startEdgeAutoScroll();
        } else if (phase === 'dropping') {
          this.stopEdgeAutoScroll();
          this.clearLeaveTimer();
          this.cancelTabFlip();
          this.playDropAnimation();
        } else if (phase === 'returning') {
          this.stopEdgeAutoScroll();
          this.clearLeaveTimer();
          this.sheetExpanded.set(false);
          this.cancelTabFlip();
          this.playReturnAnimation();
        } else if (phase === 'deescalating') {
          this.stopEdgeAutoScroll();
          this.clearLeaveTimer();
          this.sheetExpanded.set(false);
          this.cancelTabFlip();
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
        this.checkLeaveSheet(pointer);
      }
    });

    // Survol pré-escalade : pendant un cdkDrag dans un jour pas encore
    // escaladé, surveille si le doigt survole la barre repliée assez
    // longtemps pour déclencher l'escalade vers le calendrier.
    effect(() => {
      const pointer = this.dispatchService.pointer();
      const dragInfo = this.dispatchService.activeDayDrag();
      if (this.phase() === 'idle' && dragInfo) {
        this.checkEscalate(pointer, dragInfo);
      } else {
        this.clearEscalateTimer();
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

  // ── Escalade / désescalade d'un geste jour (cdkDrag → dispatch inter-jours) ──
  //
  // Avant escalade, la barre repliée du calendrier est déjà visible (voir
  // `dispatchService.sheetVisible`) pendant tout cdkDrag dans un jour : elle
  // sert de cible de survol. Un survol continu de `DAY_DRAG_ESCALATE_HOVER_MS`
  // déclenche l'escalade (bulle + déploiement du calendrier) depuis la
  // position courante du preview cdkDrag, qui reste actif en arrière-plan
  // (juste masqué, voir styles.scss) pour une reprise fluide en cas de
  // désescalade (`checkLeaveSheet`).

  private checkEscalate(pointer: { x: number; y: number }, info: DraggedActivityInfo): void {
    const inside = this.isInsideSheet(pointer);

    if (!inside) {
      this.clearEscalateTimer();
      return;
    }

    if (!this.escalateTimer) {
      this.escalateTimer = setTimeout(() => {
        this.escalateTimer = undefined;
        this.triggerEscalation(info);
      }, DAY_DRAG_ESCALATE_HOVER_MS);
    }
  }

  private clearEscalateTimer(): void {
    if (this.escalateTimer) {
      clearTimeout(this.escalateTimer);
      this.escalateTimer = undefined;
    }
  }

  private triggerEscalation(info: DraggedActivityInfo): void {
    const pointer = this.dispatchService.pointer();
    // `activeDayDragElement()` est le vrai nœud de la carte, en train de
    // suivre le doigt en direct (`position:fixed`, voir
    // ActivityCardComponent.setDragTransform/DayPanelComponent) — plus de
    // clone de preview séparé à récupérer, sa géométrie est donc toujours à
    // jour et déjà à la bonne taille (carte repliée avant même le seuil de
    // déclenchement du drag, voir `collapseInstantly`).
    const sourceEl = this.dispatchService.activeDayDragElement();
    const rect = sourceEl?.getBoundingClientRect()
      ?? new DOMRect(pointer.x - BALL_SIZE / 2, pointer.y - BALL_SIZE / 2, BALL_SIZE, BALL_SIZE);
    this.dispatchService.beginLift(info, rect, pointer.x, pointer.y);
  }

  private checkLeaveSheet(pointer: { x: number; y: number }): void {
    if (this.isInsideSheet(pointer)) {
      this.clearLeaveTimer();
      return;
    }

    if (!this.leaveTimer) {
      this.leaveTimer = setTimeout(() => {
        this.leaveTimer = undefined;
        this.dispatchService.deescalate();
      }, LEAVE_SHEET_DELAY_MS);
    }
  }

  private clearLeaveTimer(): void {
    if (this.leaveTimer) {
      clearTimeout(this.leaveTimer);
      this.leaveTimer = undefined;
    }
  }

  private isInsideSheet(pointer: { x: number; y: number }): boolean {
    const sheetRect = this.sheetRef()?.nativeElement.getBoundingClientRect();
    return !!sheetRect &&
      pointer.x >= sheetRect.left && pointer.x <= sheetRect.right &&
      pointer.y >= sheetRect.top - 32 && pointer.y <= sheetRect.bottom;
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
    this.stopTravelFollow();

    const thumbSize = Math.min(origin.height, 48);
    // Une fois le texte tassé, plus aucune marge interne (cf. scss
    // `--collapsed`) : le conteneur se réduit exactement à la taille de la
    // miniature, qui passera ensuite en mode "remplissage total".
    const collapsedWidth = thumbSize;

    ball.classList.add('dispatch-ball--collapsing');

    // Position de départ : mêmes bords que l'activity-header qu'on masque à
    // cet instant (fin liseré gris sur 3 côtés, bord gauche épais coloré) —
    // posés SANS transition, pour un état identique au pixel près dès la
    // première frame. `transition: none` + lecture de layout forcée avant de
    // la retirer, sinon cette remise à zéro (utile lors d'un 2e drag, le
    // même élément DOM étant réutilisé) se mettrait elle-même à fondre au
    // lieu d'apparaître instantanément.
    ball.style.transition = 'none';
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

    this.playCollapseFollow(ball, origin, collapsedWidth, thumbSize);
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
    origin: DOMRect,
    collapsedWidth: number,
    thumbSize: number,
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
      const height = lerp(origin.height, thumbSize, eased);
      const left = origin.left;
      const top = lerp(origin.top, target.y - height / 2, eased);

      ball.style.width = `${width}px`;
      ball.style.height = `${height}px`;
      ball.style.transform = `translate3d(${left}px, ${top}px, 0)`;

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
    const color = this.dragged()?.color ?? 'var(--p-primary-color)';
    ball.style.transition = `border-color ${BALL_TRAVEL_DURATION}ms ease`;
    ball.style.borderTopColor = color;
    ball.style.borderRightColor = color;
    ball.style.borderBottomColor = color;
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
        ball.classList.remove('dispatch-ball--collapsing');
        // Attend la fermeture CSS du calendrier (même durée dynamique que
        // l'ouverture, cf. `expandDurationMs`) avant de tout masquer :
        // sinon `finish()` bascule `isVisible` à `false` — donc le sheet en
        // `display: none` — pendant que la réplique/la grille sont encore en
        // train de s'animer, ce qui les coupe net au lieu de les laisser finir.
       this.dispatchService.finish();
       this.expandDurationMs()
        setTimeout(() => {
          
        }, );
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
    const color = this.dragged()?.color ?? 'var(--p-primary-color)';

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
          height: `${thumbSize}px`,
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

    // `border-color`, lui, n'a pas besoin de cette protection (Angular n'y
    // touche jamais) — mais s'anime mal en keyframes WAAPI, d'où une
    // transition CSS dédiée, en parallèle, ciblant uniquement cette
    // propriété : gris <- coloré sur les 3 côtés, gauche reste coloré.
    ball.style.borderLeftColor = color;
    ball.style.transition = 'none';
    ball.style.borderTopColor = color;
    ball.style.borderRightColor = color;
    ball.style.borderBottomColor = color;
    void ball.offsetHeight; // flush layout/style avant de réactiver la transition
    ball.style.transition = `border-color ${RETURN_TRAVEL_DURATION}ms ease`;
    ball.style.borderTopColor = THUMB_BORDER_GRAY;
    ball.style.borderRightColor = THUMB_BORDER_GRAY;
    ball.style.borderBottomColor = THUMB_BORDER_GRAY;

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
          .then(() => {
            // Même raison que dans `playDropAnimation` : `sheetExpanded` est
            // passé à `false` dès le début de la phase 'returning' (voir le
            // constructeur), donc la fermeture CSS du calendrier tourne déjà
            // en parallèle du retour de la bulle — mais sa durée dynamique
            // (`expandDurationMs`) dépasse maintenant celle, fixe, de la
            // bulle. On complète l'attente avant `finish()` pour ne pas
            // couper la réplique/la grille en plein milieu de leur retour.
            const cssCloseRemaining = Math.max(
              0,
              this.expandDurationMs() - (RETURN_TRAVEL_DURATION + RETURN_EXPAND_DURATION),
            );
            if (cssCloseRemaining > 0) {
              setTimeout(() => this.dispatchService.finish(), cssCloseRemaining);
            } else {
              this.dispatchService.finish();
            }
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
   * Désescalade (jour) : contrairement à `playReturnAnimation`, aucune
   * position d'origine fixe n'a de sens ici (le cdkDrag sous-jacent a
   * continué de bouger pendant l'escalade) — la bulle se redéploie donc en
   * forme de carte SUR PLACE (aucune translation) puis s'efface en fondu,
   * pendant que la vraie carte redevient visible au même endroit dès que
   * `dayEscalated()` repasse à `false` (voir `setDragHidden` côté
   * DayPanelComponent.handleDragPointerMove).
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
    const thumbSize = Math.min(origin.height, 48);
    const collapsedWidth = thumbSize;
    const pos = `translate3d(${current.left}px, ${current.top}px, 0)`;
    // Inverse exact de `startBorderColorTransition`/`playTravelFollow` : la
    // bulle (bords colorés uniformes) redevient la carte au repos (fin
    // liseré gris 3 côtés, bord gauche épais qui reste coloré).
    const color = this.dragged()?.color ?? 'var(--p-primary-color)';

    // `transform` DOIT rester piloté par WAAPI (même s'il ne change pas de
    // valeur ici, "SUR PLACE") : dès `this.formed.set(false)` ci-dessus, le
    // binding du template `[style.transform]="formed() ? ballTransform() :
    // null"` le remet à `null` au prochain cycle de détection de
    // changements. Un effet WAAPI actif prévaut sur cette remise à zéro ; une
    // simple affectation de style se ferait écraser par ce `null`, ce qui
    // faisait sauter la bulle en haut à gauche de l'écran (transform perdu).
    this.currentBallAnimation?.cancel();
    const anim = ball.animate(
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
          opacity: 1,
        },
        {
          transform: pos,
          width: `${collapsedWidth}px`,
          height: `${thumbSize}px`,
          borderRadius: `${THUMB_BORDER_RADIUS_PX}px`,
          borderTopWidth: `${THUMB_BORDER_THIN_PX}px`,
          borderRightWidth: `${THUMB_BORDER_THIN_PX}px`,
          borderBottomWidth: `${THUMB_BORDER_THIN_PX}px`,
          borderLeftWidth: `${THUMB_BORDER_LEFT_PX}px`,
          opacity: 0,
        },
      ],
      { duration: DAY_DRAG_COLLAPSE_DURATION_MS, easing: 'ease-in-out', fill: 'forwards' },
    );
    this.currentBallAnimation = anim;

    // `border-color`, lui, n'a pas besoin de cette protection (Angular n'y
    // touche jamais) — mais s'anime mal en keyframes WAAPI, d'où une
    // transition CSS dédiée, en parallèle, ciblant uniquement cette
    // propriété : gris <- coloré sur les 3 côtés, gauche reste coloré.
    ball.style.borderLeftColor = color;
    ball.style.transition = 'none';
    ball.style.borderTopColor = color;
    ball.style.borderRightColor = color;
    ball.style.borderBottomColor = color;
    void ball.offsetHeight; // flush layout/style avant de réactiver la transition
    ball.style.transition = `border-color ${DAY_DRAG_COLLAPSE_DURATION_MS}ms ease-in-out`;
    ball.style.borderTopColor = THUMB_BORDER_GRAY;
    ball.style.borderRightColor = THUMB_BORDER_GRAY;
    ball.style.borderBottomColor = THUMB_BORDER_GRAY;

    anim.finished
      .then(() => {
        ball.classList.remove('dispatch-ball--collapsing');
        this.dispatchService.finish();
      })
      .catch(() => {
        /* animation annulée : rien à faire */
      });
  }
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
