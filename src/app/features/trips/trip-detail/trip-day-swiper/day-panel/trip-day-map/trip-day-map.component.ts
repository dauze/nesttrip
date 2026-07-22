import { Component, computed, DestroyRef, effect, ElementRef, inject, input, linkedSignal, output, signal, viewChild } from '@angular/core';
import { GoogleMap, MapAdvancedMarker } from '@angular/google-maps';
import { DayMapPoint } from '@app/core/models/day-map-point';
import { GoogleMapPanelService } from '@app/core/services/google-map-panel.service';
import { environment } from '@environments/environment';
import { Panel } from 'primeng/panel';

@Component({
  selector: 'app-trip-day-map',
  standalone: true,
  imports: [GoogleMap, MapAdvancedMarker, Panel,],
  templateUrl: 'trip-day-map.component.html',
  styleUrl: 'trip-day-map.component.scss',
})
export class TripDayMapComponent {
  readonly points = signal<DayMapPoint[]>([]);
  readonly selectedActivityId = signal<string | null>(null);
  readonly googleMapPanelService = inject(GoogleMapPanelService);
  // Suit l'état partagé du service (permet à DayPanelComponent de forcer le
  // collapse pendant un drag), tout en restant localement modifiable via le
  // toggle du panneau (voir l'effet ci-dessous qui repropage vers le service).
  readonly collapsed = linkedSignal(() => this.googleMapPanelService.isCollapsed());
  zoom = input(13);
  readonly focusZoom = input(13);
  

  // Injectez l'ElementRef pour permettre au parent de manipuler son DOM
  public readonly elementRef = inject(ElementRef);

  readonly activitySelected = output<DayMapPoint>();
  private mapRef = viewChild(GoogleMap);
  private readonly destroyRef = inject(DestroyRef);

  // Écoute directe du mode sombre globale du système/navigateur utilisé par le preset Aura
  isDarkMode = signal(false);

  // Les options de la carte deviennent un computed réactif
  mapOptions = computed<google.maps.MapOptions>(() => {
    return {
      // Tu laisses l'ID de carte classique (raster ou vectoriel de base)
      mapId: environment.googleMapsMapId, 
      colorScheme: this.isDarkMode() ? 'DARK' : 'LIGHT',
      disableDefaultUI: false,
      gestureHandling: 'greedy',
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
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.isDarkMode.set(mediaQuery.matches);

    const listener = (e: MediaQueryListEvent) => this.isDarkMode.set(e.matches);
    mediaQuery.addEventListener('change', listener);
    this.destroyRef.onDestroy(() => mediaQuery.removeEventListener('change', listener));

    effect(() => {
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
      const first = pts[0];
      this.center.set({ lat: first.latitude, lng: first.longitude });
    });
  }

  markerContent(point: DayMapPoint): HTMLElement {
    // Protection indispensable au cas où Google Maps n'est pas encore totalement instancié dans le DOM
    if (typeof google === 'undefined' || !google.maps || !google.maps.marker) {
      return document.createElement('div');
    }

    const isSelected = point.activityId === this.selectedActivityId();
    const pin = new google.maps.marker.PinElement({
      glyphText: String(point.order),
      glyphColor: '#ffffff',
      background: isSelected ? '#e53935' : '#3f51b5',
      borderColor: isSelected ? '#b71c1c' : '#283593',
      scale: isSelected ? 1.2 : 1,
    });
    return pin.element;
  }

  onMarkerClick(point: DayMapPoint): void {
    this.focusOnPoint(point);
    this.activitySelected.emit(point);
  }

  private focusOnPoint(point: DayMapPoint): void {
    const map = this.mapRef()?.googleMap;
    if (!map) return;
    map.moveCamera({
      center: { lat: point.latitude, lng: point.longitude },
      zoom: this.focusZoom()
    });
  }

  followScroll(from: DayMapPoint, to: DayMapPoint, t: number): void {
    const map = this.mapRef()?.googleMap;
    if (!map) return;

    // Trajectoire non-linéaire : accélère entre 2 activités, ralentit à
    // l'approche de chacune, plutôt qu'une vitesse de caméra constante
    // calquée telle quelle sur la vitesse de scroll (voir ROADMAP.md).
    const eased = this.easeInOutQuad(Math.min(1, Math.max(0, t)));

    const targetCenter = {
      lat: this.lerp(from.latitude, to.latitude, eased),
      lng: this.lerp(from.longitude, to.longitude, eased),
    };

    // Calcul du recul
    const targetZoom = this.computeCinematicZoom(from, to, eased);

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
   */
  followFromOverview(points: DayMapPoint[], point: DayMapPoint, t: number): void {
    const map = this.mapRef()?.googleMap;
    if (!map) return;

    const eased = this.easeInOutQuad(Math.min(1, Math.max(0, t)));

    const overview = this.computeOverviewCamera(points) ?? {
      center: { lat: point.latitude, lng: point.longitude },
      zoom: this.focusZoom(),
    };

    const targetCenter = {
      lat: this.lerp(overview.center.lat, point.latitude, eased),
      lng: this.lerp(overview.center.lng, point.longitude, eased),
    };
    const targetZoom = this.lerp(overview.zoom, this.focusZoom(), eased);

    map.moveCamera({ center: targetCenter, zoom: targetZoom });
  }

  /**
   * Centre + zoom calculés pour que tous les points du jour tiennent dans le
   * conteneur de la carte (± une marge), sans dépendre de `map.fitBounds`
   * (asynchrone, nécessite un cycle "idle" avant de pouvoir relire le zoom) —
   * formule standard de calcul de zoom à partir d'une bbox lat/lng et d'une
   * taille de viewport en pixels, ce qui la rend utilisable en synchrone dans
   * la boucle de scroll.
   */
  private computeOverviewCamera(points: DayMapPoint[]): { center: google.maps.LatLngLiteral; zoom: number } | null {
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

  private easeInOutQuad(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  private computeCinematicZoom(from: DayMapPoint, to: DayMapPoint, t: number): number {
    const baseZoom = this.focusZoom();
    
    // 1. Calcul de la distance réelle
    const distanceMeters = this.haversineDistance(
      from.latitude, from.longitude,
      to.latitude, to.longitude
    );

    // 2. Configuration fine de l'effet selon la distance
    // Si les points sont à moins de 50 mètres, aucun dézoom nécessaire (valeur 0)
    if (distanceMeters < 50) {
      return baseZoom;
    }

    // Le dézoom croît avec la distance réelle, sur une échelle logarithmique
    // (comme le zoom Google Maps lui-même : chaque niveau double/divise par 2
    // l'étendue visible) plutôt qu'un barème par paliers — sans quoi 4km et
    // 50km finissent avec exactement le même dézoom max, ce qui n'a pas de
    // sens. REF_DISTANCE_METERS est la distance en dessous de laquelle aucun
    // dézoom notable n'est nécessaire ; MAX_ZOOM_DROP plafonne l'effet pour
    // rester un dip cinématique ponctuel, pas un vrai fit-bounds — sur de
    // très longues distances (ex. 50km) on ne veut pas dézoomer massivement,
    // juste suggérer le trajet.
    const REF_DISTANCE_METERS = 300;
    const ZOOM_DROP_PER_DOUBLING = 0.28;
    const MAX_ZOOM_DROP = 1.8;

    const zoomDrop = Math.min(
      MAX_ZOOM_DROP,
      Math.max(0, ZOOM_DROP_PER_DOUBLING * Math.log2(distanceMeters / REF_DISTANCE_METERS)),
    );

    // 3. Application de la parabole (0 au début, max à t=0.5, 0 à la fin)
    const arc = 4 * t * (1 - t);

    return baseZoom - (zoomDrop * arc);
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