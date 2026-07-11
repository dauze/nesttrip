import { Component, computed, input, output, viewChild } from '@angular/core';
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
  focusZoom = input(17);

  activitySelected = output<DayMapPoint>();

  private mapRef = viewChild(GoogleMap);

  mapOptions: google.maps.MapOptions = {
    mapId: environment.googleMapsMapId,
    disableDefaultUI: false,
    gestureHandling: 'greedy',
  };

  center = computed(() => {
    const pts = this.points();

    if (!pts.length) {
      return { lat: 48.8566, lng: 2.3522 };
    }

    return {
      lat: pts.reduce((sum, p) => sum + p.latitude, 0) / pts.length,
      lng: pts.reduce((sum, p) => sum + p.longitude, 0) / pts.length,
    };
  });

  markerContent(point: DayMapPoint): HTMLElement {
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

    if (!map) {
      return;
    }

    map.panTo({
      lat: point.latitude,
      lng: point.longitude,
    });

    map.setZoom(this.focusZoom());
  }
}