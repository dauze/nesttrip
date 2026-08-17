import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, computed, effect, ElementRef, inject, input, linkedSignal, output, signal, viewChild } from '@angular/core';
import { GoogleMap, MapAdvancedMarker } from '@angular/google-maps';
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

@Component({
  selector: 'app-trip-day-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GoogleMap, MapAdvancedMarker, PanelComponent,],
  templateUrl: 'trip-day-map.component.html',
  styleUrl: 'trip-day-map.component.scss',
})
export class TripDayMapComponent {
  readonly points = signal<DayMapPoint[]>([]);
  readonly selectedActivityId = signal<string | null>(null);
  readonly googleMapPanelService = inject(GoogleMapPanelService);
  private readonly photoService = inject(GooglePhotoService);
  /** URL résolue (blob) par `photoRef` — voir l'effect de chargement dans le constructeur et `markerContent`. Chaîne vide = échec, traité comme "pas de photo". */
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
  /** État de la carte AU DÉBUT du geste courant — détermine quel sens (ouverture ou fermeture) peut être validé au relâchement, voir `onGrabberPointerUp`. Stable pendant tout le geste : `collapsed` lui-même ne change qu'au commit, jamais en cours de route. */
  private collapsedAtDragStart = false;
  /** Vrai dès que le tirage a dépassé un mouvement négligeable — sert à avaler le `click` de fin de geste (voir `onGrabberClickCapture`) pour ne pas déclencher EN PLUS le toggle normal du bouton footer. */
  private dragMoved = false;
  private readonly grabberFooter = viewChild<ElementRef<HTMLElement>>('grabberFooter');

  constructor() {
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

    this.setupMapEffects();
  }

  /** Démarre le suivi dans TOUS les cas (repliée OU dépliée) — le sens qui compte au relâchement dépend de l'état capturé ici, voir `onGrabberPointerUp`. */
  protected onGrabberPointerDown(event: PointerEvent): void {
    this.dragPointerId = event.pointerId;
    this.dragStartY = event.clientY;
    this.dragMoved = false;
    this.collapsedAtDragStart = this.collapsed();
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
      // Seul le zoom est retiré (retour utilisateur : "remets tout sauf le
      // zoom") — fullscreen/street view/plan-satellite/rotation restent les
      // contrôles par défaut de Google. `cameraControl` (le bouton unifié
      // "Map camera controls", API récente) est un réglage DISTINCT de
      // `zoomControl` (l'ancien +/-) : les deux doivent être à `false`,
      // sinon le bouton unifié reste affiché même `zoomControl` désactivé
      // (constaté en vérifiant ce lot) — pinch/scroll restent pleinement
      // utilisables via `gestureHandling: 'greedy'` juste en dessous.
      zoomControl: false,
      cameraControl: false,
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
   * Vignette photo Google à la place du numéro (voir ROADMAP.md "UX /
   * Interactions") : si une photo est résolue pour ce point, un cercle avec
   * la miniature ; sinon (pas de photo Google, ou pas encore chargée, ou
   * échec) un `PinElement` classique mais SANS `glyphText` — le numéro
   * disparaît partout, y compris en fallback.
   */
  markerContent(point: DayMapPoint): HTMLElement {
    // Protection indispensable au cas où Google Maps n'est pas encore totalement instancié dans le DOM
    if (typeof google === 'undefined' || !google.maps || !google.maps.marker) {
      return document.createElement('div');
    }

    const isSelected = point.activityId === this.selectedActivityId();
    const photoUrl = point.photoRef ? this.photoUrls()[point.photoRef] : undefined;

    if (photoUrl) {
      return this.buildPhotoMarker(photoUrl, isSelected);
    }

    // PinElement étend HTMLElement : on le retourne directement plutôt que
    // sa propriété `.element`, dépréciée par l'API Google Maps. Toujours en
    // couleur primary (pin "classique", pas de rouge) — le halo/l'accent du
    // marqueur sélectionné (ROADMAP.md "### UI") passe par un bord PLUS
    // marqué (couleur active, plus épais) en plus de la taille, pas
    // seulement l'échelle comme avant. `glyphColor` DOIT être posé
    // explicitement : sans `glyphText`/`glyph`, PinElement affiche quand même
    // un petit rond central avec sa couleur par défaut (rouge Google), qui
    // ressortait comme un point rouge résiduel au milieu du pin même une
    // fois `background`/`borderColor` recolorés.
    return new google.maps.marker.PinElement({
      background: 'var(--nt-primary-color)',
      borderColor: isSelected ? 'var(--nt-primary-active-color)' : 'var(--nt-primary-hover-color)',
      glyphColor: 'var(--nt-primary-color)',
      scale: isSelected ? 1.35 : 1,
    });
  }

  /**
   * Marker "vignette" custom : construit hors du renderer Angular
   * (`document.createElement`, styles posés en inline), donc pas de CSS
   * scopé du composant qui s'y applique — voir `markerContent`.
   */
  private buildPhotoMarker(url: string, isSelected: boolean): HTMLElement {
    const size = isSelected ? 44 : 36;
    // Halo couleur primary (pas de rouge, ROADMAP.md "### UI") : un anneau
    // supplémentaire, diffus, en plus du bord — c'est lui qui donne
    // l'impression de "halo" plutôt qu'un simple bord plus épais.
    const borderColor = isSelected ? 'var(--nt-primary-active-color)' : 'var(--nt-primary-color)';
    const haloShadow = isSelected
      ? ', 0 0 0 0.25rem color-mix(in srgb, var(--nt-primary-color) 40%, transparent)'
      : '';

    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      border: ${isSelected ? 3 : 2}px solid ${borderColor};
      overflow: hidden;
      box-shadow: 0 0.125rem 0.375rem rgba(0, 0, 0, 0.35)${haloShadow};
      background: #ffffff;
    `;

    const img = document.createElement('img');
    img.src = url;
    img.alt = '';
    img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; display: block;';
    wrapper.appendChild(img);

    return wrapper;
  }

  onMarkerClick(point: DayMapPoint): void {
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
  }

  private focusOnPoint(point: DayMapPoint): void {
    const map = this.mapRef()?.googleMap;
    if (!map) return;
    map.moveCamera({
      center: { lat: point.latitude, lng: point.longitude },
      zoom: this.focusZoom()
    });
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
    const map = this.mapRef()?.googleMap;
    if (!map) return;
    map.moveCamera({ center, zoom });
  }

  followScroll(from: DayMapPoint, to: DayMapPoint, t: number): void {
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
    const targetZoom = this.computeCinematicZoom(from, to, clampedT);

    // MOVE CAMERA : La magie vectorielle opère ici en une seule passe ultra-rapide
    map.moveCamera({
      center: targetCenter,
      zoom: targetZoom
    });
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
  followFromOverview(points: DayMapPoint[], point: DayMapPoint, t: number): void {
    const map = this.mapRef()?.googleMap;
    if (!map) return;

    const s = Math.min(1, Math.max(0, t));
    const easedPosition = 1 - Math.pow(1 - s, 3);

    const overview = this.computeOverviewCamera(points) ?? {
      center: { lat: point.latitude, lng: point.longitude },
      zoom: this.focusZoom(),
    };

    const targetCenter = {
      lat: lerp(overview.center.lat, point.latitude, easedPosition),
      lng: lerp(overview.center.lng, point.longitude, easedPosition),
    };
    const targetZoom = lerp(overview.zoom, this.focusZoom(), s * s);

    map.moveCamera({ center: targetCenter, zoom: targetZoom });
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
  computeOverviewCamera(points: DayMapPoint[]): { center: google.maps.LatLngLiteral; zoom: number } | null {
    const rect = this.elementRef.nativeElement.getBoundingClientRect();
    return computeOverviewCameraUtil(points, { width: rect.width, height: rect.height }, this.focusZoom());
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
  estimateZoomDrop(from: DayMapPoint, to: DayMapPoint): number {
    const rect = this.elementRef.nativeElement.getBoundingClientRect();
    return estimateZoomDropUtil(from, to, { width: rect.width, height: rect.height }, this.focusZoom());
  }

  private computeCinematicZoom(from: DayMapPoint, to: DayMapPoint, t: number): number {
    const rect = this.elementRef.nativeElement.getBoundingClientRect();
    return computeCinematicZoomUtil(from, to, t, { width: rect.width, height: rect.height }, this.focusZoom());
  }

  get googleMap(): google.maps.Map | undefined {
    return this.mapRef()?.googleMap;
  }
}