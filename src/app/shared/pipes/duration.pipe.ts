import { Pipe, PipeTransform } from '@angular/core';

/**
 * Transforme des minutes en affichage lisible.
 * Ex: 90 → "1h 30min"  |  60 → "1h"  |  45 → "45min"
 */
@Pipe({
  name: 'duration',
  standalone: true,
})
export class DurationPipe implements PipeTransform {
  transform(minutes: number | null | undefined): string {
    if (minutes == null || minutes <= 0) return '—';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}min`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}min`;
  }
}