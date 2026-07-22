import { Pipe, PipeTransform } from '@angular/core';
import { DatePipe } from '@angular/common';

/**
 * Formate une liste de jours en une chaîne courte, ex: [21/07, 23/07] → "21/07, 23/07".
 */
@Pipe({
  name: 'dayLabelsList',
  standalone: true,
})
export class DayLabelsListPipe implements PipeTransform {
  private readonly datePipe = new DatePipe('fr-FR');

  transform(
    days: Date[] | null | undefined,
    maxItems?: number,
  ): string {
    if (!days?.length) return '';

    const labels = days.map(day => this.datePipe.transform(day, 'dd/MM')!);

    if (!maxItems || labels.length <= maxItems) {
      return labels.join(', ');
    }
    else  {
      const remaining = labels.length - maxItems;
      return `${labels.slice(0, maxItems).join(', ')} +${remaining}`;
    }
  }
}
