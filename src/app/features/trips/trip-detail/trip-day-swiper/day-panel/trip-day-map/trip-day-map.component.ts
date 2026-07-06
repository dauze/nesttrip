// trip-day-map.component.ts
import { Component, input, output, computed } from '@angular/core';
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

  activitySelected = output<DayMapPoint>();

  mapOptions: google.maps.MapOptions = {
    mapId: environment.googleMapsMapId,
    disableDefaultUI: false,
    gestureHandling: 'greedy', // évite le conflit scroll/zoom en mobile
  };

  center = computed(() => {
    const pts = this.points();
    if (!pts.length) return { lat: 48.8566, lng: 2.3522 };
    const lat = pts.reduce((s, p) => s + p.latitude, 0) / pts.length;
    const lng = pts.reduce((s, p) => s + p.longitude, 0) / pts.length;
    return { lat, lng };
  });

  markerContent(point: DayMapPoint): HTMLElement {
    const isSelected = point.activityId === this.selectedActivityId();

    const pin = new google.maps.marker.PinElement({
      glyph: String(point.order),
      glyphColor: '#ffffff',
      background: isSelected ? '#e53935' : '#3f51b5',
      borderColor: isSelected ? '#b71c1c' : '#283593',
      scale: isSelected ? 1.2 : 1,
    });

    return pin.element;
  }

  onMarkerClick(point: DayMapPoint) {
    this.activitySelected.emit(point);
  }
}