import { Injectable, OnDestroy } from '@angular/core';
import { DayMapPoint } from '@app/core/models/day-map-point';
import { TripDayMapComponent } from '../../day-panel/trip-day-map/trip-day-map.component';

export interface GeneralMapCinematicConfig {
  isActive: () => boolean;
  isExpanded: () => boolean;
  getPoints: () => DayMapPoint[];
  getMapComponent: () => TripDayMapComponent | null;
}

type Phase = 'idle-at-overview' | 'touring' | 'returning-to-overview' | 'paused-by-map';

const IDLE_MS = 2000;
// Déplacement caméra du pool volontairement bien plus lent que l'ancien
// suivi en direct (retour utilisateur "au moins 3 fois plus lent", voir
// ROADMAP.md "UX / Interactions") — un tour d'ensemble n'a pas besoin d'être
// rapide, contrairement à un suivi de scroll. Réaccéléré un peu le
// 2026-08-02 (retour utilisateur) : uniquement les déplacements
// point-à-point, `DWELL_MS` (pause SUR chaque point) reste inchangé.
const SEGMENT_MS = 3200;
const RETURN_MS = 2500;
/** Légère pause sur chaque point atteint pendant le tour, avant d'enchaîner vers le suivant — voir ROADMAP.md "UX / Interactions". */
const DWELL_MS = 700;
/**
 * Temps ajouté À LA DURÉE DE BASE (`SEGMENT_MS`/`RETURN_MS`) par niveau de
 * dézoom (voir `TripDayMapComponent.estimateZoomDrop`) — retour utilisateur :
 * une durée FIXE quelle que soit la distance (donc quelle que soit l'ampleur
 * du dézoom) ne laissait pas le temps aux tuiles Google Maps de charger sur
 * un gros dézoom (ex. Bruxelles -> Paris), rendu qui semblait "sauter" d'une
 * phase (déplacement) à l'autre (zoom) au lieu de transitionner ensemble —
 * voir ROADMAP.md "UX / Interactions". Un petit trajet (dézoom ~0) garde
 * exactement `SEGMENT_MS`/`RETURN_MS`, comportement déjà jugé "parfait".
 */
const MS_PER_ZOOM_LEVEL = 600;

/**
 * Caméra du pool d'activités de l'onglet Général : entièrement décorrélée du
 * scroll (contrairement à la vue jour, voir `DayScrollSyncService`/
 * `cameraFollowEnabled`) — machine à états dédiée, voir ROADMAP.md "UX /
 * Interactions" pour le comportement cible détaillé avec l'utilisateur.
 *
 * 3 états (une action ailleurs sur la page — scroll du pool, clic sur une
 * carte d'activité, recherche, tri... — n'a AUCUN effet sur la cinématique,
 * seule une action DIRECTEMENT sur la carte la met en pause, retour
 * utilisateur) :
 * - `idle-at-overview` : repos, caméra sur la vue d'ensemble (tous les
 *   points, `TripDayMapComponent.computeOverviewCamera`).
 * - `touring` : promenade lente point à point (réutilise
 *   `TripDayMapComponent.followScroll`, même algo/easing que l'ancien suivi
 *   caméra en direct, mais piloté par le TEMPS via `requestAnimationFrame`
 *   plutôt que par la position de scroll) — `SEGMENT_MS` volontairement bien
 *   plus lent que l'ancien suivi en direct (retour utilisateur), avec une
 *   légère pause (`DWELL_MS`) sur chaque point atteint avant d'enchaîner.
 * - `paused-by-map` : action DIRECTEMENT sur la carte (drag, zoom, clic
 *   marqueur) — l'automatisme se fige, la caméra n'est JAMAIS touchée
 *   (l'utilisateur garde la main), `tourPointIndex` retient où en était le
 *   tour pour reprendre exactement là après 2s d'inactivité (pas de retour à
 *   la vue d'ensemble, pas de redémarrage au point 1).
 *
 * `returning-to-overview` : retour en douceur vers la vue d'ensemble
 * uniquement en fin de tour (dernier point atteint) — plus jamais déclenché
 * par une action "page", voir ci-dessus.
 *
 * Détection d'action sur la carte uniquement (voir `attachMap`) :
 * `dragstart` (Google Maps, jamais émis par nos propres `moveCamera`
 * programmatiques, contrairement à `zoom_changed` — évite une boucle
 * d'auto-déclenchement) + `wheel`/`touchstart` natifs sur le conteneur de la
 * carte (zoom molette/pincement, eux aussi strictement utilisateur) + clic
 * marqueur (`activitySelected`).
 */
@Injectable()
export class GeneralMapCinematicService implements OnDestroy {
  private config!: GeneralMapCinematicConfig;

  private phase: Phase = 'idle-at-overview';
  private tourPointIndex = 0;
  private generation = 0;
  private idleTimer?: number;
  private dwellTimer?: number;
  private wakeLockSentinel: WakeLockSentinel | null = null;

  private mapGoogleListeners: google.maps.MapsEventListener[] = [];
  private mapSubscription?: { unsubscribe: () => void };
  private mapContainerEl: HTMLElement | null = null;

  connect(config: GeneralMapCinematicConfig): void {
    this.config = config;
  }

  startListening(): void {
    this.scheduleIdle();
  }

  /** Rattachement à l'instance UNIQUE de carte partagée, une fois déplacée dans ce contexte — même moment que `DayScrollSyncService.attachMap` côté appelant. */
  attachMap(map: TripDayMapComponent): void {
    this.mapSubscription?.unsubscribe();
    this.mapSubscription = map.activitySelected.subscribe(() => this.onMapAction());

    this.detachMapListeners();
    const containerEl: HTMLElement = map.elementRef.nativeElement;
    this.mapContainerEl = containerEl;
    containerEl.addEventListener('wheel', this.onMapAction, { passive: true });
    containerEl.addEventListener('touchstart', this.onMapAction, { passive: true });

    const nativeMap = map.googleMap;
    if (nativeMap) {
      this.mapGoogleListeners.push(google.maps.event.addListener(nativeMap, 'dragstart', () => this.onMapAction()));
    }

    // Position de repos initiale = vue d'ensemble, cohérente avec l'état
    // `idle-at-overview` (best-effort : si les points ne sont pas encore
    // prêts, `onIdleTimeout` re-tentera au prochain minuteur).
    const overview = map.computeOverviewCamera(this.config.getPoints());
    if (overview) map.moveCameraTo(overview.center, overview.zoom);
  }

  private detachMapListeners(): void {
    this.mapGoogleListeners.forEach(l => l.remove());
    this.mapGoogleListeners = [];
    this.mapContainerEl?.removeEventListener('wheel', this.onMapAction);
    this.mapContainerEl?.removeEventListener('touchstart', this.onMapAction);
    this.mapContainerEl = null;
  }

  /** Action directement sur la carte : fige l'automatisme SANS toucher à la caméra, l'utilisateur garde la main — reprise du tour là où il en était après 2s d'inactivité. */
  private readonly onMapAction = (): void => {
    if (!this.config.isActive()) return;
    clearTimeout(this.idleTimer);
    this.generation++;
    this.releaseWakeLock();
    this.phase = 'paused-by-map';
    this.scheduleIdle();
  };

  private scheduleIdle(): void {
    clearTimeout(this.idleTimer);
    this.idleTimer = window.setTimeout(() => this.onIdleTimeout(), IDLE_MS);
  }

  /**
   * À appeler au début de chaque frame/callback d'une animation en cours
   * (`step()` de `enterTour`/`runSegment`/`returnToOverview`, callbacks de
   * `dwellTimer`) : `generation` seul protège contre une animation
   * SUPPLANTÉE PAR UNE AUTRE ICI (nouvelle action, nouveau tour...), mais pas
   * contre le cas où ce contexte devient inactif EN COURS DE VOL (retour
   * utilisateur — l'utilisateur quitte l'onglet Général pour un jour pendant
   * qu'un tour tournait) : rien n'incrémente `generation` dans ce cas, donc
   * la boucle `requestAnimationFrame`/`setTimeout` continuait à appeler
   * `moveCameraTo`/`followScroll`/`followFromOverview` sur l'instance UNIQUE
   * de carte, désormais réattribuée à un autre contexte (jour) — la vue
   * d'ensemble du jour se faisait "voler" sa caméra par le tour du pool en
   * fin de course. Retourne `true` si l'appelant doit s'arrêter net (déjà
   * géré ici : périmé -> rien à faire de plus ; inactif -> repos + retente
   * plus tard, même logique que la branche `isActive()` de `onIdleTimeout`).
   */
  private shouldAbort(generation: number): boolean {
    if (generation !== this.generation) return true;
    if (!this.config.isActive()) {
      this.generation++;
      this.phase = 'idle-at-overview';
      this.releaseWakeLock();
      this.scheduleIdle();
      return true;
    }
    return false;
  }

  private onIdleTimeout(): void {
    const points = this.config.getPoints();
    if (!this.config.isActive() || !this.config.isExpanded() || points.length < 2) {
      this.scheduleIdle();
      return;
    }

    // Départ FRAIS depuis la vue d'ensemble (pas une reprise après pause,
    // voir `paused-by-map`) : transition d'abord vers le point 0 (voir
    // `enterTour`) avant d'enchaîner les segments — sans ça, `runSegment`
    // démarrerait directement au point 0 (t=0 => `followScroll` y place la
    // caméra INSTANTANÉMENT), d'où le saut brut vue d'ensemble -> 1er point
    // remonté par l'utilisateur.
    const resuming = this.phase === 'paused-by-map';

    this.generation++;
    const generation = this.generation;
    this.phase = 'touring';
    this.acquireWakeLock();

    if (resuming) {
      this.runSegment(points, this.tourPointIndex, generation);
    } else {
      this.enterTour(points, generation);
    }
  }

  /** Transition douce vue d'ensemble -> 1er point (réutilise `TripDayMapComponent.followFromOverview`, piloté par le temps comme un segment). */
  private enterTour(points: DayMapPoint[], generation: number): void {
    const map = this.config.getMapComponent();
    // Amplitude du "zoom in" overview -> point 0 (même raisonnement que les
    // segments, voir MS_PER_ZOOM_LEVEL) : écart entre le zoom de la vue
    // d'ensemble et le zoom de focus habituel.
    const overview = map?.computeOverviewCamera(points);
    const zoomDrop = map && overview ? Math.max(0, map.focusZoom() - overview.zoom) : 0;
    const duration = SEGMENT_MS + zoomDrop * MS_PER_ZOOM_LEVEL;
    const start = performance.now();

    const step = (now: number): void => {
      if (this.shouldAbort(generation)) return;
      const t = Math.min(1, (now - start) / duration);
      this.config.getMapComponent()?.followFromOverview(points, points[0], t);

      if (t < 1) {
        requestAnimationFrame(step);
        return;
      }
      // Légère pause sur le 1er point aussi (comme tous les autres, voir
      // `runSegment`), avant d'enchaîner vers le 2e — retour utilisateur.
      this.dwellTimer = window.setTimeout(() => {
        if (this.shouldAbort(generation)) return;
        this.runSegment(points, 0, generation);
      }, DWELL_MS);
    };

    requestAnimationFrame(step);
  }

  /**
   * Un segment du tour = un appel `followScroll(points[i], points[i+1], t)`
   * piloté par le temps (même algo/easing que l'ancien suivi en direct, voir
   * la doc de classe), suivi d'une légère pause (`DWELL_MS`) une fois le
   * point atteint avant d'enchaîner vers le suivant — y compris sur le
   * DERNIER point, avant `returnToOverview` (retour utilisateur : la pause
   * doit être la même sur tous les points, premier et dernier compris).
   */
  private runSegment(points: DayMapPoint[], index: number, generation: number): void {
    if (generation !== this.generation) return;

    if (index >= points.length - 1) {
      this.tourPointIndex = 0;
      this.returnToOverview(generation);
      return;
    }

    const from = points[index];
    const to = points[index + 1];
    const map = this.config.getMapComponent();
    const zoomDrop = map?.estimateZoomDrop(from, to) ?? 0;
    const duration = SEGMENT_MS + zoomDrop * MS_PER_ZOOM_LEVEL;
    const start = performance.now();

    const step = (now: number): void => {
      if (this.shouldAbort(generation)) return;
      const t = Math.min(1, (now - start) / duration);
      this.config.getMapComponent()?.followScroll(from, to, t);

      if (t < 1) {
        requestAnimationFrame(step);
        return;
      }
      this.tourPointIndex = index + 1;
      this.dwellTimer = window.setTimeout(() => {
        if (this.shouldAbort(generation)) return;
        this.runSegment(points, index + 1, generation);
      }, DWELL_MS);
    };

    requestAnimationFrame(step);
  }

  /**
   * Tween manuel (pas de méthode existante pour "état caméra arbitraire ->
   * vue d'ensemble") : réutilise EXACTEMENT la 1re moitié de la courbe d'un
   * segment point-à-point (`TripDayMapComponent.followScroll`, confirmée
   * "parfaite") — voir la doc de `TripDayMapComponent.followFromOverview`
   * pour la dérivation complète (même principe, sens inverse ici) :
   * - position : `s³` (ease-IN cubique — substituer t=0.5s dans
   *   `easeInOutCubic`, `4·(0.5s)³` ramené sur [0,1] donne `s³`).
   * - zoom : `2s-s²` comme fraction de dézoom déjà "acquis" (substituer
   *   t=0.5s dans `4t(1-t)` donne `2s-s²`, déjà sur [0,1]).
   */
  private returnToOverview(generation: number): void {
    const map = this.config.getMapComponent();
    const from = map?.getCameraState();
    const overview = map?.computeOverviewCamera(this.config.getPoints());

    if (!map || !from || !overview) {
      this.phase = 'idle-at-overview';
      this.releaseWakeLock();
      this.scheduleIdle();
      return;
    }

    this.phase = 'returning-to-overview';
    this.acquireWakeLock();
    // Même raisonnement que les segments (voir MS_PER_ZOOM_LEVEL) : plus
    // l'écart de zoom à parcourir est grand, plus la transition a besoin de
    // temps pour laisser les tuiles suivre.
    const duration = RETURN_MS + Math.abs(overview.zoom - from.zoom) * MS_PER_ZOOM_LEVEL;
    const start = performance.now();

    const step = (now: number): void => {
      if (this.shouldAbort(generation)) return;
      const s = Math.min(1, (now - start) / duration);
      const easedPosition = s * s * s;
      map.moveCameraTo(
        {
          lat: this.lerp(from.center.lat, overview.center.lat, easedPosition),
          lng: this.lerp(from.center.lng, overview.center.lng, easedPosition),
        },
        this.lerp(from.zoom, overview.zoom, 2 * s - s * s),
      );

      if (s < 1) {
        requestAnimationFrame(step);
        return;
      }
      this.phase = 'idle-at-overview';
      this.releaseWakeLock();
      this.scheduleIdle();
    };

    requestAnimationFrame(step);
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  /** Feature-detecté (Wake Lock API non supportée partout) : échec silencieux, jamais bloquant — voir ROADMAP.md "l'écran ne doit pas se mettre en veille pendant l'animation". */
  private acquireWakeLock(): void {
    if (this.wakeLockSentinel || !('wakeLock' in navigator)) return;
    navigator.wakeLock.request('screen')
      .then(sentinel => { this.wakeLockSentinel = sentinel; })
      .catch(() => { /* refusé/non supporté — pas bloquant */ });
  }

  private releaseWakeLock(): void {
    this.wakeLockSentinel?.release().catch(() => { /* déjà relâché — pas bloquant */ });
    this.wakeLockSentinel = null;
  }

  ngOnDestroy(): void {
    clearTimeout(this.idleTimer);
    clearTimeout(this.dwellTimer);
    this.generation++;
    this.releaseWakeLock();
    this.mapSubscription?.unsubscribe();
    this.detachMapListeners();
  }
}
