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

  transform(days: Date[] | null | undefined): string {
    if (!days?.length) return '';
    return days.map((day) => this.datePipe.transform(day, 'dd/MM')).join(', ');
  }
}
