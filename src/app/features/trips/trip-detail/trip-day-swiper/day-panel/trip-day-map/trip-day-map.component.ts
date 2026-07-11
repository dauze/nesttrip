import { Component, computed, DestroyRef, inject, input, output, signal, viewChild } from '@angular/core';
import { GoogleMap, MapAdvancedMarker } from '@angular/google-maps';
import { DayMapPoint } from '@app/core/models/day-map-point';
import { environment } from '@environnements/environnement';
import { Panel } from 'primeng/panel';

@Component({
  selector: 'app-trip-day-map',
  standalone: true,
  imports: [GoogleMap, MapAdvancedMarker, Panel],
  templateUrl: 'trip-day-map.component.html',
})
export class TripDayMapComponent {
  points = input.required<DayMapPoint[]>();
  selectedActivityId = input<string | null>(null);
  zoom = input(13);
  readonly focusZoom = input(14);

  activitySelected = output<DayMapPoint>();
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

  center = computed(() => {
    const pts = this.points();
    if (!pts.length) return { lat: 48.8566, lng: 2.3522 };
    return {
      lat: pts.reduce((sum, p) => sum + p.latitude, 0) / pts.length,
      lng: pts.reduce((sum, p) => sum + p.longitude, 0) / pts.length,
    };
  });

  constructor() {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.isDarkMode.set(mediaQuery.matches);

    const listener = (e: MediaQueryListEvent) => this.isDarkMode.set(e.matches);
    mediaQuery.addEventListener('change', listener);
    this.destroyRef.onDestroy(() => mediaQuery.removeEventListener('change', listener));
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

    const targetCenter = {
      lat: this.lerp(from.latitude, to.latitude, t),
      lng: this.lerp(from.longitude, to.longitude, t),
    };

    // Calcul du recul
    const targetZoom = this.computeCinematicZoom(from, to, t);

    // MOVE CAMERA : La magie vectorielle opère ici en une seule passe ultra-rapide
    map.moveCamera({
      center: targetCenter,
      zoom: targetZoom
    });
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

    // On définit dynamiquement l'amplitude du dézoom (zoomDrop) selon la distance
    let zoomDrop = 0;

    if (distanceMeters < 500) {
      // Très proche (50m à 500m) : dézoom très léger (entre 0 et 1 niveau de zoom max)
      zoomDrop = this.lerp(0, 1, (distanceMeters - 50) / 450);
    } else if (distanceMeters < 3000) {
      // Distance moyenne (500m à 3km) : dézoom modéré (entre 1 et 2.5 niveaux de zoom)
      zoomDrop = this.lerp(1, 2.5, (distanceMeters - 500) / 2500);
    } else {
      // Longue distance (Plus de 3km) : gros dézoom (bloqué au max à 4 niveaux de zoom)
      zoomDrop = Math.min(4.0, this.lerp(2.5, 4.0, (distanceMeters - 3000) / 10000));
    }

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
}