import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, input, linkedSignal, output, signal, viewChild } from '@angular/core';
import { GoogleMap, MapAdvancedMarker } from '@angular/google-maps';
import { DayMapPoint } from '@app/core/models/day-map-point';
import { GoogleMapPanelService } from '@app/core/services/google-map-panel.service';
import { ThemeService } from '@app/core/services/theme.service';
import { TripDayMapHostService } from '@app/core/services/trip-day-map-host.service';
import { ViewportService } from '@app/core/services/viewport.service';
import { environment } from '@environments/environment';
import { PanelComponent } from '@app/shared/components/panel/panel.component';

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
  /** `protected` : lu depuis le template pour basculer `[toggleable]`/`[bare]` selon le contexte (voir trip-day-map.component.html). */
  protected readonly mapHost = inject(TripDayMapHostService);
  // Contexte 'general' (pool, uniquement l'onglet Résumé désormais — voir
  // ROADMAP.md "UX / Interactions", 2026-08-01) : jamais repliable (plus de
  // panel/chevron dans ce contexte, voir trip-day-map.component.html), donc
  // toujours `false`. Contexte 'day' : suit GoogleMapPanelService, tout en
  // restant localement modifiable via le toggle du panneau (voir l'effet
  // ci-dessous qui repropage vers ce service). Se réaligne sur le service
  // courant dès que `currentOwner()` change de valeur.
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
  readonly center = signal<google.maps.LatLngLiteral>({ lat: 48.8566, lng: 2.3522 });
  private lastPointsKey: string | null = null;

  constructor() {
    effect(() => {
      // Contexte 'general' : rien à repropager, `collapsed` y est une
      // constante (voir sa doc) — jamais modifiable par l'utilisateur.
      if (this.mapHost.currentOwner() === 'general') return;
      this.googleMapPanelService.setCollapse(this.collapsed());
    });

    effect(() => {
      const pts = this.points();
      if (!pts.length) return;

      // Clé stable indépendante de l'ordre : identifie le JOUR affiché,
      // pas le contenu de chaque activité.
      const key = pts.map(p => p.activityId).sort().join('|');
      if (key === this.lastPointsKey) {
        // Même jour, juste une mise à jour de données : on ne touche pas
        // au centre pour ne pas couper le focus/scroll de l'utilisateur.
        return;
      }

      this.lastPointsKey = key;

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
  }

  markerContent(point: DayMapPoint): HTMLElement {
    // Protection indispensable au cas où Google Maps n'est pas encore totalement instancié dans le DOM
    if (typeof google === 'undefined' || !google.maps || !google.maps.marker) {
      return document.createElement('div');
    }

    const isSelected = point.activityId === this.selectedActivityId();
    // PinElement étend HTMLElement : on le retourne directement plutôt que
    // sa propriété `.element`, dépréciée par l'API Google Maps.
    return new google.maps.marker.PinElement({
      glyphText: String(point.order),
      glyphColor: '#ffffff',
      background: isSelected ? '#e53935' : '#3f51b5',
      borderColor: isSelected ? '#b71c1c' : '#283593',
      scale: isSelected ? 1.2 : 1,
    });
  }

  onMarkerClick(point: DayMapPoint): void {
    this.focusOnPoint(point);
    this.activitySelected.emit(point);
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
    const eased = this.easeInOutCubic(clampedT);

    const targetCenter = {
      lat: this.lerp(from.latitude, to.latitude, eased),
      lng: this.lerp(from.longitude, to.longitude, eased),
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
      lat: this.lerp(overview.center.lat, point.latitude, easedPosition),
      lng: this.lerp(overview.center.lng, point.longitude, easedPosition),
    };
    const targetZoom = this.lerp(overview.zoom, this.focusZoom(), s * s);

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
    if (!points.length) return null;
    if (points.length === 1) {
      return { center: { lat: points[0].latitude, lng: points[0].longitude }, zoom: this.focusZoom() };
    }

    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    for (const p of points) {
      minLat = Math.min(minLat, p.latitude);
      maxLat = Math.max(maxLat, p.latitude);
      minLng = Math.min(minLng, p.longitude);
      maxLng = Math.max(maxLng, p.longitude);
    }

    const center = { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };

    const rect = this.elementRef.nativeElement.getBoundingClientRect();
    // Marge pour ne pas coller les marqueurs extrêmes aux bords de la carte —
    // généreuse car un pin dépasse largement au-dessus de son point ancré
    // (la pointe touche le point, la tête ronde avec le numéro est ~40-50px
    // plus haut), pas juste un point ponctuel.
    const PADDING_PX = 64;
    const width = Math.max(1, rect.width - PADDING_PX * 2);
    const height = Math.max(1, rect.height - PADDING_PX * 2);

    // Petit dézoom de sécurité en plus de la marge ci-dessus : la formule
    // bbox->zoom ne connaît que les coordonnées géographiques des points, pas
    // la taille réelle des pins à l'écran (numéro inclus) — sans cette marge
    // les pins des points extrêmes débordent legèrement du cadre visible.
    const OVERVIEW_ZOOM_BUFFER = 0.4;

    // Ne jamais dézoomer plus que nécessaire : si les points sont proches,
    // pas d'intérêt à zoomer plus serré que le zoom de focus habituel.
    const zoom = Math.max(
      1,
      Math.min(
        this.getBoundsZoomLevel(minLat, maxLat, minLng, maxLng, width, height) - OVERVIEW_ZOOM_BUFFER,
        this.focusZoom(),
      ),
    );

    return { center, zoom };
  }

  /** cf. https://stackoverflow.com/a/13274361 — calcul déterministe du zoom Google Maps pour un bbox donné, sans passer par `fitBounds`. */
  private getBoundsZoomLevel(
    minLat: number,
    maxLat: number,
    minLng: number,
    maxLng: number,
    mapWidth: number,
    mapHeight: number,
  ): number {
    const ZOOM_MAX = 21;
    const WORLD_DIM = 256;

    const latRad = (lat: number) => {
      const sin = Math.sin((lat * Math.PI) / 180);
      const radX2 = Math.log((1 + sin) / (1 - sin)) / 2;
      return Math.max(Math.min(radX2, Math.PI), -Math.PI) / 2;
    };

    const zoomForFraction = (mapPx: number, fraction: number) =>
      Math.log(mapPx / WORLD_DIM / fraction) / Math.LN2;

    const latFraction = (latRad(maxLat) - latRad(minLat)) / Math.PI;
    const lngDiff = maxLng - minLng;
    const lngFraction = (lngDiff < 0 ? lngDiff + 360 : lngDiff) / 360;

    const latZoom = zoomForFraction(mapHeight, latFraction);
    const lngZoom = zoomForFraction(mapWidth, lngFraction);

    return Math.max(1, Math.min(latZoom, lngZoom, ZOOM_MAX));
  }

  /**
   * Ease-in-out CUBIC (pas quad) : ralentit plus franchement à l'approche de
   * chaque point (et au départ) qu'une simple parabole quad — voir
   * ROADMAP.md "UX / Interactions", retour utilisateur "il faut vraiment que
   * ce soit ralenti entre l'approche des points".
   */
  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
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
    const baseZoom = this.focusZoom();

    const distanceMeters = this.haversineDistance(
      from.latitude, from.longitude,
      to.latitude, to.longitude
    );
    if (distanceMeters < 50) return 0;

    const rect = this.elementRef.nativeElement.getBoundingClientRect();
    const PADDING_PX = 64;
    const width = Math.max(1, rect.width - PADDING_PX * 2);
    const height = Math.max(1, rect.height - PADDING_PX * 2);
    const OVERVIEW_ZOOM_BUFFER = 0.4;
    const MAX_ZOOM_DROP = 6;

    const minLat = Math.min(from.latitude, to.latitude);
    const maxLat = Math.max(from.latitude, to.latitude);
    const minLng = Math.min(from.longitude, to.longitude);
    const maxLng = Math.max(from.longitude, to.longitude);

    const idealZoom = this.getBoundsZoomLevel(minLat, maxLat, minLng, maxLng, width, height) - OVERVIEW_ZOOM_BUFFER;
    return Math.min(MAX_ZOOM_DROP, Math.max(0, baseZoom - idealZoom));
  }

  private computeCinematicZoom(from: DayMapPoint, to: DayMapPoint, t: number): number {
    const baseZoom = this.focusZoom();
    const zoomDrop = this.estimateZoomDrop(from, to);
    return baseZoom - (zoomDrop * this.zoomEnvelope(t));
  }

  /**
   * Enveloppe de dézoom, pilotée par `t` BRUT (pas `eased`, voir
   * `followScroll`) — parabole `4t(1-t)` : lisse (dérivée nulle SEULEMENT au
   * sommet, pas de palier plat), pente la plus raide pile au départ/à
   * l'arrivée. Historique : une tente linéaire (pic anguleux, retirée) puis
   * une rampe+palier (retour utilisateur : "un dézoom-rezoom en carré", le
   * palier donnait une impression figée/carrée plutôt qu'une vraie courbe,
   * voir ROADMAP.md) ont chacune été essayées et retirées. Piloter cette
   * parabole par `t` BRUT (pas `eased`, contrairement aux tout premiers
   * essais) reste le vrai correctif : sans ça, la parabole d'une valeur déjà
   * elle-même "ease-in-out" créait une double distorsion, perçue comme un
   * dézoom décorrélé du déplacement.
   */
  private zoomEnvelope(t: number): number {
    return 4 * t * (1 - t);
  }

  private haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  get googleMap(): google.maps.Map | undefined {
    return this.mapRef()?.googleMap;
  }
}