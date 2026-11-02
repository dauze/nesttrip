import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, computed, effect, ElementRef, inject, input, linkedSignal, output, signal, viewChild } from '@angular/core';
import { GoogleMap, MapAdvancedMarker, MapCircle, MapPolyline } from '@angular/google-maps';
import { DayMapPoint } from '@app/core/models/day-map-point';
import { GoogleMapPanelService } from '@app/core/services/ui/google-map-panel.service';
import { GooglePhotoService } from '@app/core/services/api/google-photo.service';
import { ThemeService } from '@app/core/services/ui/theme.service';
import { TripDayMapHostService } from '@app/core/services/ui/trip-day-map-host.service';
import { ViewportService } from '@app/core/services/ui/viewport.service';
import { environment } from '@environments/environment';
import { PanelComponent, PanelToggleEvent } from '@app/shared/components/layout/panel/panel.component';
import {
  computeCinematicZoom as computeCinematicZoomUtil,
  computeOverviewCamera as computeOverviewCameraUtil,
  easeInOutCubic,
  estimateZoomDrop as estimateZoomDropUtil,
  lerp,
} from '@app/shared/utils/map-camera.util';
import { smoothPath, smoothPathUntil } from '@app/shared/utils/map-path-smoothing.util';

/** Repli ultime (Paris) si la destination du trip n'a pas pu être résolue (`defaultCenter`, voir plus bas) — ex. trip sans `placeId`, résolution en échec, ou pas encore résolue. */
const PARIS_FALLBACK_CENTER: google.maps.LatLngLiteral = { lat: 48.8566, lng: 2.3522 };

/**
 * Tirage minimal (px) au relâchement pour VALIDER une bascule (ouverture
 * DEPUIS repliée, fermeture DEPUIS dépliée) — sinon la carte revient à son
 * état de départ. Seuil FIXE (pas une fraction de la hauteur du contenu,
 * ancienne approche) : la carte suit le doigt AU PIXEL PRÈS
 * (`PanelComponent.dragPullPx`), donc rien à faire dépendre de sa hauteur
 * réelle ici — cohérent avec les seuils "geste vs tap" déjà utilisés
 * ailleurs (`LongPressDirective`).
 */
const DRAG_COMMIT_PX = 60;

/** Écart max (en fraction de segment) autour d'une activité pour la considérer « atteinte » pendant le scroll. */
const ARRIVAL_THRESHOLD = 0.2;

/** Durée de recentrage quand la zone recouverte par le panneau change — alignée sur l'animation de repli du panneau. */
const INSET_TWEEN_MS = 280;

@Component({
  selector: 'app-trip-day-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GoogleMap, MapAdvancedMarker, MapCircle, MapPolyline, PanelComponent],
  templateUrl: 'trip-day-map.component.html',
  styleUrl: 'trip-day-map.component.scss',
})
export class TripDayMapComponent {
  readonly points = signal<DayMapPoint[]>([]);
  protected readonly userPosition = signal<google.maps.LatLngLiteral | null>(null);
  protected readonly userPositionAccuracy = signal(0);
  protected readonly locatingUser = signal(false);
  protected readonly locationError = signal<string | null>(null);
  protected readonly userAccuracyCircleOptions: google.maps.CircleOptions = {
    fillColor: '#4285F4', fillOpacity: 0.14, strokeColor: '#4285F4', strokeOpacity: 0.45,
    strokeWeight: 1, clickable: false, zIndex: 2,
  };
  protected readonly userLocationDotOptions: google.maps.CircleOptions = {
    fillColor: '#4285F4', fillOpacity: 1, strokeColor: '#ffffff', strokeOpacity: 1,
    strokeWeight: 2, clickable: false, zIndex: 3,
  };
  protected readonly routePaths = computed(() => {
    const pointsByDay = new Map<string, DayMapPoint[]>();
    for (const point of this.points()) {
      const dayKey = point.dayId ?? 'active-day';
      const dayPoints = pointsByDay.get(dayKey) ?? [];
      dayPoints.push(point);
      pointsByDay.set(dayKey, dayPoints);
    }
    return [...pointsByDay.entries()]
      .map(([dayKey, points]) => {
        const rawPath = [...points]
          .sort((left, right) => left.order - right.order)
          .map((point) => ({ lat: point.latitude, lng: point.longitude }));
        // Courbe lisse passant par chaque activité (ROADMAP.md "UX /
        // Interactions", 2026-10-30) au lieu de segments droits "carrés".
        return { dayKey, path: smoothPath(rawPath) };
      })
      .filter((route) => route.path.length > 1);
  });
  protected readonly routeLineOptions = computed<google.maps.PolylineOptions>(() => {
    this.isDarkMode();
    const strokeColor = getComputedStyle(document.documentElement).getPropertyValue('--nt-primary-color').trim();
    return {
      strokeColor,
      // Vue Jour : tracé complet en retrait, le chemin parcouru (`progressLine`) passe par-dessus.
      strokeOpacity: this.mapHost.currentOwner() === 'day' ? 0.4 : 0.72,
      strokeWeight: 3,
      clickable: false,
      geodesic: true,
      zIndex: 1,
    };
  });
  /** Points du jour dans l'ordre de parcours (contexte 'day' uniquement) : base de la numérotation et du chemin parcouru. */
  private readonly dayRoute = computed(() =>
    this.mapHost.currentOwner() === 'day' ? [...this.points()].sort((left, right) => left.order - right.order) : [],
  );
  private readonly dayRouteIndex = computed(() => new Map(this.dayRoute().map((point, index) => [point.activityId, index])));
  /** Activité « atteinte » par le scroll (ou cliquée) : marqueur agrandi. */
  private readonly highlightedActivityId = signal<string | null>(null);
  private readonly markerRefs = new Map<string, google.maps.marker.AdvancedMarkerElement>();
  /** Chemin déjà parcouru : polyline impérative, mise à jour à chaque frame de scroll sans détection de changement. */
  private progressLine: google.maps.Polyline | null = null;
  /** Dernière caméra demandée, AVANT décalage du panneau — rejouée quand ce décalage change. */
  private lastLogicalCamera: { center: google.maps.LatLngLiteral; zoom: number } | null = null;
  /** Valeur courante (animée) de `cameraInset`, utilisée par tous les calculs de caméra. */
  private appliedInset = 0;
  private insetAnimationFrame = 0;
  readonly googleMapPanelService = inject(GoogleMapPanelService);
  private readonly photoService = inject(GooglePhotoService);
  /** URL résolue (blob) par `photoRef` — voir l'effect de chargement dans le constructeur et `markerContents`. Chaîne vide = échec, traité comme "pas de photo". */
  private readonly photoUrls = signal<Record<string, string>>({});
  private readonly requestedPhotoRefs = new Set<string>();
  /** `protected` : lu depuis le template pour basculer `[toggleable]`/`[bare]` selon le contexte (voir trip-day-map.component.html). */
  protected readonly mapHost = inject(TripDayMapHostService);
  // Contexte 'general' (pool, uniquement l'onglet Résumé désormais — voir
  // ROADMAP.md "UX / Interactions", 2026-08-01) : jamais repliable (plus de
  // panel/chevron dans ce contexte, voir trip-day-map.component.html), donc
  // toujours `false`. Contexte 'day' : suit GoogleMapPanelService (y compris
  // une fois la préférence Firestore de l'utilisateur chargée de façon
  // asynchrone — un `linkedSignal` se recalcule automatiquement dès que
  // `isCollapsed()`/`currentOwner()` changent), tout en restant localement
  // modifiable via le toggle du panneau (repropagé vers le service par
  // `onCollapsedToggled`, voir sa doc — UNIQUEMENT sur un vrai geste
  // utilisateur, jamais via un `effect()` générique sur ce signal).
  readonly collapsed = linkedSignal(() =>
    this.mapHost.currentOwner() === 'general' ? false : this.googleMapPanelService.isCollapsed(),
  );
  zoom = input(13);
  readonly focusZoom = input(13);
  protected readonly viewport = inject(ViewportService);
  /**
   * Layout scindé (carte à gauche, voir ROADMAP.md "UI Desktop") : le panel
   * s'étire pleine hauteur (`PanelComponent.fillHeight`) et la carte suit via
   * `height="100%"` — `32dvh` sinon (empilé mobile, OU contexte 'general' —
   * onglet Résumé, voir ROADMAP.md "UX / Interactions", 2026-08-01 — qui
   * n'est JAMAIS un layout scindé carte/liste quelle que soit la largeur de
   * viewport, contrairement à l'ancien onglet Activités qu'il remplace).
   * Sans cette exclusion, `:host { height:100% }` (voir
   * trip-day-map.component.scss) se propageait contre un ancêtre
   * (`.trip-summary-map-container`) sans hauteur explicite définie — carte
   * réduite à 0px de haut, invisible, en layout scindé desktop.
   */
  protected readonly useSplitHeight = computed(() => this.viewport.isSplitLayout() && this.mapHost.currentOwner() !== 'general');
  /** Vue Jour desktop : carte plein écran sous des éléments flottants, sans cadre (voir TripDetailDesktopComponent). */
  protected readonly edgeToEdge = computed(() => !this.viewport.isMobileChrome() && this.mapHost.currentOwner() === 'day');
  /** Largeur (px) recouverte à gauche par le panneau flottant : la caméra centre sur la zone visible restante. */
  private readonly cameraInset = computed(() => (this.edgeToEdge() ? this.mapHost.desktopMapInsetLeft() : 0));
  protected readonly useMobileFullscreenHeight = computed(() =>
    this.googleMapPanelService.isFullscreen() && this.mapHost.currentOwner() === 'day' && !this.viewport.isSplitLayout(),
  );
  protected readonly mobileMapHeight = computed(() => {
    if (this.useSplitHeight() || this.useMobileFullscreenHeight()) return '100%';
    const dragDelta = this.dragPullPx();
    if (!this.collapsedAtDragStart && dragDelta !== null && dragDelta > 0) return `calc(32dvh + ${dragDelta}px)`;
    return '32dvh';
  });


  // Injectez l'ElementRef pour permettre au parent de manipuler son DOM
  public readonly elementRef = inject(ElementRef);

  readonly activitySelected = output<DayMapPoint>();
  private mapRef = viewChild(GoogleMap);
  private readonly themeService = inject(ThemeService);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Geste de tirage BIDIRECTIONNEL sur `.map-panel__grabber` (footer
   * togglable, voir trip-day-map.component.html) — en plus du clic déjà géré
   * par `PanelComponent.toggle()` : tirer vers le BAS ouvre la carte repliée
   * en suivant le doigt, tirer vers le HAUT referme la carte dépliée, tout
   * aussi symétriquement (retour utilisateur explicite : le geste de
   * fermeture manquait à la 1ère version, "vers le bas" uniquement).
   * `dragPullPx` (delta signé en px depuis le point de départ, `null` = pas
   * de drag en cours) pilote directement `PanelComponent.dragPullPx` : ce
   * composant ne mesure jamais lui-même la hauteur du contenu ni ne clampe
   * quoi que ce soit selon le sens, seul `PanelComponent` (propriétaire de
   * `#content`, connaît l'état de départ ET la hauteur réelle) sait le
   * faire — voir sa doc. Track AU PIXEL PRÈS (pas de mapping distance
   * arbitraire -> fraction, ancienne approche qui faisait glisser le
   * panneau plus vite que le doigt — retour utilisateur).
   */
  protected readonly dragPullPx = signal<number | null>(null);
  private dragPointerId: number | null = null;
  private dragStartY = 0;
  private fullscreenAtDragStart = false;
  /** État de la carte AU DÉBUT du geste courant — détermine quel sens (ouverture ou fermeture) peut être validé au relâchement, voir `onGrabberPointerUp`. Stable pendant tout le geste : `collapsed` lui-même ne change qu'au commit, jamais en cours de route. */
  private collapsedAtDragStart = false;
  /** Vrai dès que le tirage a dépassé un mouvement négligeable — sert à avaler le `click` de fin de geste (voir `onGrabberClickCapture`) pour ne pas déclencher EN PLUS le toggle normal du bouton footer. */
  private dragMoved = false;
  private readonly grabberFooter = viewChild<ElementRef<HTMLElement>>('grabberFooter');

  constructor() {
    effect(() => {
      if (this.mapHost.currentOwner() !== 'day' && this.googleMapPanelService.isFullscreen()) {
        this.googleMapPanelService.setFullscreen(false);
      }
    });

    afterNextRender(() => {
      document.addEventListener('pointermove', this.onGrabberPointerMove);
      document.addEventListener('pointerup', this.onGrabberPointerUp);
      document.addEventListener('pointercancel', this.onGrabberPointerUp);

      // Écouteur natif posé impérativement (PAS un `(click)` de template) :
      // ce n'est pas un nouveau contrôle interactif pour l'utilisateur (le
      // vrai bouton accessible/focusable reste `<button class="app-panel__footer-toggle">`,
      // posé par `PanelComponent` — voir sa doc), juste un mécanisme technique
      // de désambiguïsation tap/drag qui doit s'exécuter AVANT que ce click
      // n'atteigne ce bouton (`capture: true`) — passer par le template
      // déclenchait à tort les règles a11y `click-events-have-key-events`/
      // `interactive-supports-focus` sur un simple `<div>` de contenu projeté.
      const footerEl = this.grabberFooter()?.nativeElement;
      footerEl?.addEventListener('click', this.onGrabberClickCapture, { capture: true });

      this.destroyRef.onDestroy(() => {
        document.removeEventListener('pointermove', this.onGrabberPointerMove);
        document.removeEventListener('pointerup', this.onGrabberPointerUp);
        document.removeEventListener('pointercancel', this.onGrabberPointerUp);
        footerEl?.removeEventListener('click', this.onGrabberClickCapture, { capture: true });
      });
    });

    this.destroyRef.onDestroy(() => {
      cancelAnimationFrame(this.insetAnimationFrame);
      this.progressLine?.setMap(null);
    });

    this.setupMapEffects();
  }

  /** Démarre le suivi dans TOUS les cas (repliée OU dépliée) — le sens qui compte au relâchement dépend de l'état capturé ici, voir `onGrabberPointerUp`. */
  protected onGrabberPointerDown(event: PointerEvent): void {
    this.dragPointerId = event.pointerId;
    this.dragStartY = event.clientY;
    this.dragMoved = false;
    this.collapsedAtDragStart = this.collapsed();
    this.fullscreenAtDragStart = this.googleMapPanelService.isFullscreen();
    this.dragPullPx.set(0);
  }

  private readonly onGrabberPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.dragPointerId) return;
    const delta = event.clientY - this.dragStartY;
    if (Math.abs(delta) > 4) this.dragMoved = true;
    // Delta BRUT, signé, sans clamp ici : `PanelComponent.dragPullPx` fait
    // déjà tout le travail de bornage selon l'état de départ (voir sa doc)
    // — un delta "dans le mauvais sens" (tirer vers le haut alors que
    // repliée, ou vers le bas alors que dépliée) y est simplement absorbé
    // sans effet visuel, pas besoin de le filtrer nous-mêmes ici.
    this.dragPullPx.set(delta);
  };

  private readonly onGrabberPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.dragPointerId) return;
    const delta = this.dragPullPx() ?? 0;
    this.dragPointerId = null;
    // Repasse à `null` (pas de valeur figée) : `PanelComponent` reprend la
    // main via `collapsed()` et sa propre transition CSS anime le reste du
    // trajet (bascule validée) ou le retour à l'état de départ (annulée) —
    // voir sa doc.
    this.dragPullPx.set(null);

    if (this.collapsedAtDragStart && delta >= DRAG_COMMIT_PX) {
      this.collapsed.set(false);
      this.onCollapsedToggled({ collapsed: false });
    } else if (this.fullscreenAtDragStart && delta <= -DRAG_COMMIT_PX) {
      this.googleMapPanelService.setFullscreen(false);
    } else if (!this.collapsedAtDragStart && !this.fullscreenAtDragStart && delta >= DRAG_COMMIT_PX) {
      this.googleMapPanelService.setFullscreen(true);
    } else if (!this.collapsedAtDragStart && delta <= -DRAG_COMMIT_PX) {
      this.collapsed.set(true);
      this.onCollapsedToggled({ collapsed: true });
    }
  };

  /**
   * Posé en phase de CAPTURE sur `.map-panel__footer-icons` (voir le
   * constructeur), donc évalué avant le `(click)` du `<button>` de
   * `PanelComponent` qui l'englobe : avale le click de fin de geste quand un
   * vrai tirage a eu lieu, pour ne pas déclencher EN PLUS
   * `PanelComponent.toggle()` (qui refermerait aussitôt une ouverture par
   * tirage tout juste validée). Un simple tap (jamais `dragMoved`) laisse le
   * click continuer normalement vers ce toggle.
   */
  private readonly onGrabberClickCapture = (event: MouseEvent): void => {
    if (this.dragMoved) {
      event.stopPropagation();
      event.preventDefault();
    }
    this.dragMoved = false;
  };

  // Suit ThemeService (mode clair/sombre/système choisi dans le menu
  // réglages, voir sa doc) plutôt qu'un matchMedia local : un seul point de
  // vérité réactif, qui répond aussi bien à un choix explicite qu'à un
  // changement système, sans recharger la page.
  isDarkMode = this.themeService.isDark;

  // Les options de la carte deviennent un computed réactif
  mapOptions = computed<google.maps.MapOptions>(() => {
    return {
      // Tu laisses l'ID de carte classique (raster ou vectoriel de base)
      mapId: environment.googleMapsMapId,
      colorScheme: this.isDarkMode() ? 'DARK' : 'LIGHT',
      disableDefaultUI: false,
      // Zoom retiré (retour utilisateur : "remets tout sauf le zoom"), et
      // fullscreen ÉGALEMENT retiré : le bouton plein écran NATIF de Google
      // s'appuie sur l'API Fullscreen du navigateur posée sur le conteneur de
      // la carte, mais un ANCÊTRE porte un `transform` (voir
      // `.day-fixed-map--active`, trip-detail.component.scss — il suit le
      // hide-on-scroll de la toolbar). Un `transform` non-`none` sur un
      // ancêtre casse le rendu de l'élément fullscreen : le navigateur
      // entre puis ressort aussitôt du plein écran — exactement le
      // scintillement + retour à l'état précédent remonté par l'utilisateur.
      // De toute façon l'app a son PROPRE plein écran (panel mobile :
      // `useMobileFullscreenHeight`, tirage sur le grabber), donc ce bouton
      // natif faisait doublon en plus d'être cassé ici. Street
      // view/plan-satellite/rotation restent, eux, les contrôles par défaut.
      // `cameraControl` (le bouton unifié "Map camera controls", API récente)
      // est un réglage DISTINCT de `zoomControl` (l'ancien +/-) : les deux
      // doivent être à `false`, sinon le bouton unifié reste affiché même
      // `zoomControl` désactivé (constaté en vérifiant ce lot) — pinch/scroll
      // restent pleinement utilisables via `gestureHandling: 'greedy'` juste
      // en dessous.
      zoomControl: false,
      cameraControl: false,
      fullscreenControl: false,
      gestureHandling: 'greedy',
      // Sans ce flag, le zoom fractionnaire est désactivé PAR DÉFAUT sur une
      // carte raster (activé par défaut seulement en vectoriel) — chaque
      // `zoom` non entier calculé par `followScroll`/`computeCinematicZoom`
      // (ex. 11.73) est alors silencieusement ARRONDI à l'entier le plus
      // proche par l'API AVANT rendu, transformant toute courbe de zoom
      // continue (parabole comprise) en une poignée de sauts discrets entre
      // niveaux entiers — exactement les "sauts"/"pas une courbe du tout"
      // remontés par l'utilisateur, quelle que soit la formule JS utilisée
      // en amont. Cette app bascule déjà en raster dans cet environnement
      // (voir le warning console "Falling back to Raster" et
      // ROADMAP.md "Warnings de dépréciation Google Maps").
      isFractionalZoomEnabled: true,
      // Desktop : le haut et la gauche de la carte sont recouverts par la barre
      // des jours et le panneau flottants. Dépend du seul mode de chrome (pas du
      // contexte jour/général) : changer `options` recentre la carte et réinitialise
      // son type (`GoogleMap._combineOptions`).
      ...(this.viewport.isMobileChrome()
        ? {}
        : {
            mapTypeControlOptions: { position: google.maps.ControlPosition.BOTTOM_CENTER },
            streetViewControlOptions: { position: google.maps.ControlPosition.RIGHT_CENTER },
          }),
    };
  });

  // Le centre n'est plus un `computed` recalculé à chaque changement de
  // `points` : sinon toute mise à jour de données (édition d'une activité,
  // persistance Firestore...) recalcule `points` et force un recentrage
  // intempestif sur le 1er point, écrasant le focus/scroll en cours.
  // On ne recalcule le centre par défaut que lors d'un VRAI changement de
  // jour (un nouveau set d'activityId), pas lors d'une simple mise à jour
  // de champs sur les activités déjà affichées.
  readonly center = signal<google.maps.LatLngLiteral>(PARIS_FALLBACK_CENTER);
  private lastPointsKey: string | null = null;

  /** Coordonnées de la destination du trip (résolues depuis `Trip.placeId` par `TripDaySwiperComponent`, seul appelant) — centre par défaut affiché quand le jour/contexte courant n'a aucune activité géolocalisée, à la place de Paris (ROADMAP.md "### UI", "la carte doit être centrée sur le placeid du trip"). `null` tant que non résolu ou si le trip n'a pas de destination : repli sur `PARIS_FALLBACK_CENTER`. */
  readonly defaultCenter = signal<google.maps.LatLngLiteral | null>(null);

  private setupMapEffects(): void {
    effect(() => {
      const pts = this.points();

      // Clé stable indépendante de l'ordre : identifie le JOUR affiché,
      // pas le contenu de chaque activité. Chaîne vide = jour sans aucune
      // activité géolocalisée (cas distinct traité ci-dessous).
      const key = pts.length ? pts.map(p => p.activityId).sort().join('|') : '';
      if (key === this.lastPointsKey) {
        // Même jour, juste une mise à jour de données : on ne touche pas
        // au centre pour ne pas couper le focus/scroll de l'utilisateur.
        return;
      }

      this.lastPointsKey = key;
      this.clearDayProgress();

      if (!pts.length) {
        // Bascule vers un jour/contexte sans AUCUNE activité géolocalisée
        // (ROADMAP.md "### UI", "il y a toujours l'ancien contenu de la
        // map") : sans ce reset, la caméra reste bloquée sur la position du
        // dernier jour affiché — ni DayScrollSyncService ni
        // GeneralMapCinematicService n'ont de point vers lequel recentrer
        // dans ce cas (tous deux nécessitent au moins un point), le early
        // return ci-dessous (cas non-vide) ne s'applique donc pas ici. Retour
        // à la même vue par défaut qu'au tout premier chargement, avant
        // toute donnée (voir la valeur initiale de `center`) — imperative
        // (`moveCameraTo`), jamais `this.center.set()`, voir le commentaire
        // juste en dessous.
        this.moveCameraTo(this.defaultCenter() ?? PARIS_FALLBACK_CENTER, this.zoom());
        return;
      }

      // NE JAMAIS écraser `center` ici, ni pour 'general' ni pour 'day'.
      // `center`/`zoom` sont liés en réactif au template (`[center]="center()"`),
      // donc un simple `.set()` ici percute la caméra INDÉPENDAMMENT de tout
      // appel impératif (`moveCameraTo`/`moveCamera`) : ce recentrage sur le
      // 1er point, pensé à l'origine comme centre par défaut avant tout
      // scroll/tour, gagnait la course contre la vue d'ensemble posée par le
      // système dédié à chaque contexte dès que `points` changeait (montage,
      // tri, filtre...) — `GeneralMapCinematicService.attachMap` pour
      // 'general', `DayScrollSyncService.updateMapFromScroll` (via `wakeLoop`)
      // pour 'day' — d'où la caméra qui semblait "sauter" sur un point (voire
      // rester bloquée dessus, zoom orphelin d'un tour interrompu) au lieu de
      // rester/partir de la vue d'ensemble — retour utilisateur, voir
      // ROADMAP.md. Les DEUX contextes ont désormais leur propre système
      // établissant la caméra correcte à l'activation ; ce recentrage par
      // défaut n'est plus nécessaire nulle part.
    });

    // `defaultCenter` se résout de façon asynchrone (géocodage du `placeId`
    // du trip, voir sa doc) : peut arriver APRÈS le premier passage de
    // l'effect ci-dessus, qui aurait alors déjà affiché le repli Paris faute
    // de mieux. Recentre sur la vraie destination dès qu'elle est connue,
    // mais seulement si le jour/contexte affiché n'a toujours aucune
    // activité géolocalisée (sinon la vue d'ensemble déjà posée par
    // `GeneralMapCinematicService`/`DayScrollSyncService` ne doit pas être
    // écrasée, même raison que le early-return juste au-dessus).
    effect(() => {
      const coords = this.defaultCenter();
      if (!coords || this.points().length) return;
      this.moveCameraTo(coords, this.zoom());
    });

    effect(() => {
      if (this.mapHost.currentOwner() !== 'day') this.clearDayProgress();
    });

    // Surbrillance appliquée sur les éléments existants (pas de reconstruction) pour que la transition CSS joue.
    effect(() => {
      const highlighted = this.highlightedActivityId();
      for (const [activityId, element] of this.markerContents()) {
        const isOn = activityId === highlighted;
        element.style.transform = isOn ? 'scale(1.35)' : '';
        element.style.filter = isOn ? `drop-shadow(0 0 0.4rem ${element.dataset['glow']})` : '';
        const marker = this.markerRefs.get(activityId);
        if (marker) marker.zIndex = isOn ? 1000 : null;
      }
    });

    // Repli/dépli du panneau desktop : la caméra glisse vers le centre de la nouvelle zone visible.
    effect(() => {
      const target = this.cameraInset();
      cancelAnimationFrame(this.insetAnimationFrame);
      const from = this.appliedInset;
      if (from === target) return;

      const start = performance.now();
      const step = (now: number) => {
        const progress = Math.min(1, (now - start) / INSET_TWEEN_MS);
        this.appliedInset = lerp(from, target, easeInOutCubic(progress));
        const camera = this.lastLogicalCamera;
        if (camera) this.applyCamera(camera.center, camera.zoom);
        if (progress < 1) this.insetAnimationFrame = requestAnimationFrame(step);
      };
      this.insetAnimationFrame = requestAnimationFrame(step);
    });

    // Miniature photo Google sur les markers (voir ROADMAP.md "UX /
    // Interactions", remplace le numéro partout) : charge paresseusement
    // l'URL (blob, via GooglePhotoService — mise en cache par ref au niveau
    // du service, partagée avec le reste de l'app) de toute ref pas encore
    // demandée dès qu'elle apparaît dans `points()`, sans jamais re-fetcher.
    effect(() => {
      for (const point of this.points()) {
        const ref = point.photoRef;
        if (!ref || this.requestedPhotoRefs.has(ref)) continue;
        this.requestedPhotoRefs.add(ref);
        this.photoService.getPhotoUrl$(ref, 96).subscribe((url) => {
          this.photoUrls.update((map) => ({ ...map, [ref]: url }));
        });
      }
    });
  }

  /**
   * Contenu de chaque marqueur, construit une fois par point/photo (stable à
   * travers la surbrillance, voir l'effect dédié) : vignette photo Google si
   * résolue, sinon `PinElement` sans glyphe, plus la pastille de rang 1..n en
   * vue Jour.
   */
  protected readonly markerContents = computed(() => {
    const photoUrls = this.photoUrls();
    const ranks = this.dayRouteIndex();
    const contents = new Map<string, HTMLElement>();
    for (const point of this.points()) {
      const rank = ranks.get(point.activityId);
      const photoUrl = point.photoRef ? photoUrls[point.photoRef] : undefined;
      contents.set(point.activityId, this.buildMarker(point, photoUrl, rank === undefined ? null : rank + 1));
    }
    return contents;
  });

  private buildMarker(point: DayMapPoint, photoUrl: string | undefined, rank: number | null): HTMLElement {
    const typeColor = `var(${point.colorVar ?? '--nt-primary-color'})`;
    const wrapper = document.createElement('div');
    wrapper.dataset['glow'] = `color-mix(in srgb, ${typeColor} 70%, transparent)`;
    wrapper.style.cssText = `
      position: relative;
      transform-origin: 50% 100%;
      transition: transform 220ms cubic-bezier(0.4, 0, 0.2, 1), filter 220ms ease;
    `;

    // Protection indispensable au cas où Google Maps n'est pas encore totalement instancié dans le DOM
    if (typeof google === 'undefined' || !google.maps || !google.maps.marker) return wrapper;

    // `glyphColor` explicite : sans glyphe, PinElement affiche sinon un rond central rouge Google.
    wrapper.appendChild(photoUrl
      ? this.buildPhotoMarker(photoUrl, typeColor)
      : new google.maps.marker.PinElement({ background: typeColor, borderColor: typeColor, glyphColor: typeColor }));
    if (rank !== null) wrapper.appendChild(this.buildRankBadge(rank));
    return wrapper;
  }

  /**
   * Marker "vignette" custom : construit hors du renderer Angular
   * (`document.createElement`, styles posés en inline), donc pas de CSS
   * scopé du composant qui s'y applique — voir `buildMarker`.
   */
  private buildPhotoMarker(url: string, typeColor: string): HTMLElement {
    const frame = document.createElement('div');
    frame.style.cssText = `
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: 2px solid ${typeColor};
      overflow: hidden;
      box-shadow: 0 0.125rem 0.375rem rgba(0, 0, 0, 0.35);
      background: #ffffff;
    `;

    const img = document.createElement('img');
    img.src = url;
    img.alt = '';
    img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; display: block;';
    frame.appendChild(img);

    return frame;
  }

  private buildRankBadge(rank: number): HTMLElement {
    const badge = document.createElement('span');
    badge.textContent = String(rank);
    badge.style.cssText = `
      position: absolute;
      top: -6px;
      right: -9px;
      box-sizing: border-box;
      min-width: 18px;
      height: 18px;
      padding: 0 4px;
      border-radius: 999px;
      border: 2px solid #ffffff;
      background: var(--nt-primary-color);
      color: var(--nt-primary-contrast-color);
      font: 700 10px/14px system-ui, sans-serif;
      text-align: center;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
      pointer-events: none;
    `;
    return badge;
  }

  /** Créée à chaque instance `google.maps.Map` (recréée au changement de thème, voir le template). */
  protected onMapInitialized(map: google.maps.Map): void {
    this.progressLine?.setMap(null);
    const color = getComputedStyle(document.documentElement).getPropertyValue('--nt-primary-color').trim();
    this.progressLine = new google.maps.Polyline({
      map,
      clickable: false,
      geodesic: true,
      strokeColor: color,
      strokeOpacity: 1,
      strokeWeight: 6,
      zIndex: 2,
      icons: [{
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 5, fillColor: color, fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2 },
        offset: '100%',
      }],
    });
  }

  /** `progress` = index fractionnaire dans `dayRoute` (0 = 1re activité) ; `null` = rien de parcouru. */
  private setDayProgress(progress: number | null): void {
    const route = this.dayRoute();
    if (progress === null || !route.length) {
      this.clearDayProgress();
      return;
    }

    this.progressLine?.setPath(route.length > 1
      ? smoothPathUntil(route.map((point) => ({ lat: point.latitude, lng: point.longitude })), progress)
      : []);

    const nearest = Math.round(progress);
    this.highlightedActivityId.set(
      Math.abs(progress - nearest) <= ARRIVAL_THRESHOLD ? route[nearest]?.activityId ?? null : null,
    );
  }

  private clearDayProgress(): void {
    this.progressLine?.setPath([]);
    this.highlightedActivityId.set(null);
  }

  onMarkerClick(point: DayMapPoint): void {
    if (this.mapHost.currentOwner() === 'day') this.highlightedActivityId.set(point.activityId);

    if (this.googleMapPanelService.isFullscreen() && this.mapHost.currentOwner() === 'day') {
      this.googleMapPanelService.setFullscreen(false);
      requestAnimationFrame(() => {
        this.focusOnPoint(point);
        this.activitySelected.emit(point);
      });
      return;
    }

    this.focusOnPoint(point);
    this.activitySelected.emit(point);
  }

  /**
   * Repropage vers `GoogleMapPanelService` UNIQUEMENT sur une vraie bascule
   * utilisateur (`afterToggle`, émis par `PanelComponent.toggle()` — clic sur
   * le footer/chevron) — jamais via un `effect()` générique sur `collapsed()`
   * (ancienne approche, retirée) : `collapsed` (linkedSignal) se recalcule
   * aussi tout seul quand `googleMapPanelService.isCollapsed()` change pour
   * une raison EXTERNE (ex. la préférence Firestore de l'utilisateur qui
   * arrive de façon asynchrone, après le tout premier rendu) — un `effect()`
   * réagissant à CE changement le repropageait alors vers `setCollapse()`,
   * marquant `GoogleMapPanelService.seeded` à tort et empêchant ensuite la
   * vraie préférence de jamais s'appliquer une fois chargée (ROADMAP.md
   * "Bugs / fixes", "la récupération du flag... ne fonctionne pas" — la
   * carte repartait toujours dépliée après un rechargement). En ne
   * repropageant que sur `afterToggle` (un vrai geste), ce risque de course
   * est éliminé structurellement plutôt que contourné par un flag "premier
   * passage ignoré".
   */
  protected onCollapsedToggled(event: PanelToggleEvent): void {
    // Contexte 'general' : rien à repropager, `collapsed` y est une
    // constante (voir sa doc) — jamais modifiable par l'utilisateur, ce
    // bouton n'existe même pas dans ce contexte (voir le template).
    if (this.mapHost.currentOwner() === 'general') return;
    if (event.collapsed && this.googleMapPanelService.isFullscreen()) {
      this.collapsed.set(false);
      this.googleMapPanelService.setFullscreen(false);
      return;
    }
    this.googleMapPanelService.setCollapse(event.collapsed);
  }

  // `(mapClick)` de @angular/google-maps s'appuie sur `advancedMarker.addListener('click', ...)`,
  // dépréciée par l'API Google Maps au profit de `addEventListener('gmp-click', ...)` — on pose
  // donc l'écouteur nous-mêmes sur le marker natif exposé par `markerInitialized`.
  onMarkerInitialized(marker: google.maps.marker.AdvancedMarkerElement, point: DayMapPoint): void {
    // `gmpClickable` n'est pas activé automatiquement par un simple
    // `addEventListener('gmp-click', ...)` posé à la main (contrairement au
    // helper `addListener` historique) : sans ce flag, le marker reste
    // visuellement affiché mais ne reçoit AUCUN clic réel (les clics
    // traversent jusqu'à la carte en dessous) — seul un événement `gmp-click`
    // déclenché programmatiquement passait encore, d'où le clic qui ne
    // recentrait/scrollait plus rien en usage normal.
    marker.gmpClickable = true;
    marker.addEventListener('gmp-click', () => this.onMarkerClick(point));
    this.markerRefs.set(point.activityId, marker);
    if (point.activityId === this.highlightedActivityId()) marker.zIndex = 1000;
  }

  private focusOnPoint(point: DayMapPoint): void {
    this.moveCameraTo({ lat: point.latitude, lng: point.longitude }, this.focusZoom());
  }

  /** Lecture directe de l'état caméra courant — utilisé par `GeneralMapCinematicService` pour tweener depuis un état arbitraire (pas forcément un point/l'overview connus à l'avance), voir sa doc. */
  getCameraState(): { center: google.maps.LatLngLiteral; zoom: number } | null {
    const map = this.mapRef()?.googleMap;
    const center = map?.getCenter();
    const zoom = map?.getZoom();
    if (!center || zoom === undefined) return null;
    return { center: center.toJSON(), zoom };
  }

  /** Déplacement caméra direct (sans easing propre) — le tween éventuel est piloté par l'appelant, voir `GeneralMapCinematicService`. */
  moveCameraTo(center: google.maps.LatLngLiteral, zoom: number): void {
    this.lastLogicalCamera = { center, zoom };
    this.applyCamera(center, zoom);
  }

  /**
   * Le centre demandé doit apparaître au milieu de la zone NON recouverte par
   * le panneau : on décale le centre réel de la carte de `inset / 2` px vers
   * l'ouest (Mercator : 360° de longitude = 256·2^zoom px).
   */
  private applyCamera(center: google.maps.LatLngLiteral, zoom: number): void {
    const map = this.mapRef()?.googleMap;
    if (!map) return;
    const lngPerPx = 360 / (256 * Math.pow(2, zoom));
    map.moveCamera({ center: { lat: center.lat, lng: center.lng - (this.appliedInset / 2) * lngPerPx }, zoom });
  }

  /** Taille de la zone de carte réellement visible (hors panneau flottant), pour les calculs de zoom. */
  private visibleSize(): { width: number; height: number } {
    const rect = this.elementRef.nativeElement.getBoundingClientRect();
    return { width: Math.max(1, rect.width - this.appliedInset), height: rect.height };
  }

  protected locateUser(): void {
    this.locationError.set(null);
    if (!navigator.geolocation) {
      this.locationError.set('La géolocalisation n’est pas disponible sur cet appareil.');
      return;
    }

    this.locatingUser.set(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const position = { lat: coords.latitude, lng: coords.longitude };
        this.userPosition.set(position);
        this.userPositionAccuracy.set(coords.accuracy);
        this.locatingUser.set(false);
        this.moveCameraTo(position, Math.max(this.zoom(), 15));
      },
      (error) => {
        this.locatingUser.set(false);
        this.locationError.set(error.code === error.PERMISSION_DENIED
          ? 'Autorise l’accès à ta position pour l’afficher sur la carte.'
          : 'Position indisponible pour le moment.');
      },
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 10_000 },
    );
  }

  followScroll(from: DayMapPoint, to: DayMapPoint, t: number, maxZoomDrop = 6): void {
    const map = this.mapRef()?.googleMap;
    if (!map) return;

    const clampedT = Math.min(1, Math.max(0, t));

    // Trajectoire non-linéaire : accélère entre 2 activités, ralentit à
    // l'approche de chacune, plutôt qu'une vitesse de caméra constante
    // calquée telle quelle sur la vitesse de scroll (voir ROADMAP.md).
    const eased = easeInOutCubic(clampedT);

    const targetCenter = {
      lat: lerp(from.latitude, to.latitude, eased),
      lng: lerp(from.longitude, to.longitude, eased),
    };

    // Calcul du recul — piloté par `clampedT` (BRUT), pas `eased` : voir la
    // doc de `zoomEnvelope`, le zoom a volontairement son propre rythme,
    // découplé de celui du déplacement.
    const targetZoom = this.computeCinematicZoom(from, to, clampedT, maxZoomDrop);

    this.moveCameraTo(targetCenter, targetZoom);

    if (this.mapHost.currentOwner() === 'day') {
      const fromIndex = this.dayRouteIndex().get(from.activityId);
      const toIndex = this.dayRouteIndex().get(to.activityId);
      if (fromIndex !== undefined && toIndex !== undefined) {
        this.setDayProgress(fromIndex + (toIndex - fromIndex) * eased);
      }
    }
  }

  /**
   * Segment "avant la 1re activité" : la caméra part d'une vue d'ensemble
   * (tous les points du jour) et se resserre progressivement vers le focus
   * sur `point` au fur et à mesure du scroll — voir `DayPanelComponent.updateMapFromScroll`
   * pour le calcul de `t` (0 en haut du jour, 1 quand la 1re activité est
   * "atteinte", où `followScroll` prend ensuite le relai).
   *
   * Ni easing arbitraire ni tente/parabole retentée à l'aveugle cette fois
   * (retours utilisateur précédents, voir ROADMAP.md) : demande explicite —
   * réutiliser EXACTEMENT la 2e moitié de la courbe d'un segment point-à-point
   * (`followScroll`/`computeCinematicZoom`, confirmée "parfaite"), le point
   * milieu (t=0.5 du segment, où le dézoom est maximal) faisant office de vue
   * d'ensemble. Dérivation :
   * - position (`easeInOutCubic`, 2e branche pour t≥0.5) : en substituant
   *   t=0.5+0.5s et en ramenant sur [0,1], `2·easeInOutCubic(0.5+0.5s)-1`
   *   se simplifie en `1-(1-s)³` — un ease-OUT cubique standard.
   * - zoom (`4t(1-t)`, même substitution) : se simplifie en `1-s²` comme
   *   fraction de dézoom restant, donc `s²` comme fraction de zoom déjà
   *   "regagné" — un ease-IN quadratique.
   * Mêmes formules (sens inverse) dans `GeneralMapCinematicService.returnToOverview`.
   */
  followFromOverview(points: DayMapPoint[], point: DayMapPoint, t: number, overviewZoomBuffer = 0.4): void {
    const map = this.mapRef()?.googleMap;
    if (!map) return;

    const s = Math.min(1, Math.max(0, t));
    const easedPosition = 1 - Math.pow(1 - s, 3);

    const overview = this.computeOverviewCamera(points, overviewZoomBuffer) ?? {
      center: { lat: point.latitude, lng: point.longitude },
      zoom: this.focusZoom(),
    };

    const targetCenter = {
      lat: lerp(overview.center.lat, point.latitude, easedPosition),
      lng: lerp(overview.center.lng, point.longitude, easedPosition),
    };
    const targetZoom = lerp(overview.zoom, this.focusZoom(), s * s);

    this.moveCameraTo(targetCenter, targetZoom);

    if (this.mapHost.currentOwner() === 'day') {
      // Rien n'est encore parcouru avant la 1re activité ; elle s'allume à l'approche.
      this.progressLine?.setPath([]);
      this.highlightedActivityId.set(s >= 1 - ARRIVAL_THRESHOLD ? point.activityId : null);
    }
  }

  /**
   * Centre + zoom calculés pour que tous les points du jour tiennent dans le
   * conteneur de la carte (± une marge), sans dépendre de `map.fitBounds`
   * (asynchrone, nécessite un cycle "idle" avant de pouvoir relire le zoom) —
   * formule standard de calcul de zoom à partir d'une bbox lat/lng et d'une
   * taille de viewport en pixels, ce qui la rend utilisable en synchrone dans
   * la boucle de scroll. Public : réutilisé par `GeneralMapCinematicService`
   * pour la vue d'ensemble du pool (même calcul, mêmes points).
   */
  computeOverviewCamera(points: DayMapPoint[], overviewZoomBuffer = 0.4): { center: google.maps.LatLngLiteral; zoom: number } | null {
    return computeOverviewCameraUtil(points, this.visibleSize(), this.focusZoom(), overviewZoomBuffer);
  }

  /**
   * Amplitude du dézoom cinématique entre 2 points : zoom RÉEL nécessaire
   * pour que les 2 points tiennent dans le cadre (même formule bbox->zoom
   * que `computeOverviewCamera`/`getBoundsZoomLevel`, même marge), plafonnée
   * à `MAX_ZOOM_DROP` — un premier retrait total du plafond (l'ancien
   * `MAX_ZOOM_DROP = 1.8` était ridiculement insuffisant sur de longues
   * distances) s'est révélé légèrement trop généreux à son tour sur de très
   * longues distances (retour utilisateur, Bruxelles -> Paris) : replafonné
   * à une valeur bien plus généreuse que l'origine, mais pas illimitée.
   * Public : réutilisé par `GeneralMapCinematicService` pour faire durer un
   * segment proportionnellement à son amplitude de dézoom (voir sa doc —
   * une transition à durée FIXE quelle que soit la distance ne laissait pas
   * aux tuiles Google Maps le temps de charger sur un gros dézoom, d'où un
   * rendu qui semblait "sauter" au lieu de transitionner).
   */
  estimateZoomDrop(from: DayMapPoint, to: DayMapPoint, maxZoomDrop = 6): number {
    return estimateZoomDropUtil(from, to, this.visibleSize(), this.focusZoom(), maxZoomDrop);
  }

  private computeCinematicZoom(from: DayMapPoint, to: DayMapPoint, t: number, maxZoomDrop = 6): number {
    return computeCinematicZoomUtil(from, to, t, this.visibleSize(), this.focusZoom(), maxZoomDrop);
  }

  get googleMap(): google.maps.Map | undefined {
    return this.mapRef()?.googleMap;
  }
}