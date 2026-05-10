import { Component, ElementRef, inject, input, ViewChild } from '@angular/core';
import { Alerts } from '../../../core/models/travel.models';
import { SafeHtmlPipe } from '../../../shared/pipes/safe-html.pipe';
import { TabService } from '../../../core/services/tab.service';

@Component({
  selector: 'app-alert-box',
  standalone: true,
  imports: [SafeHtmlPipe],
  styleUrl : 'alert-box.component.scss',
  templateUrl:'alert-box.component.html' ,
})
export class AlertBoxComponent {
  private readonly travel = inject(TabService);
  readonly alerts = input.required<Alerts>();

  @ViewChild('listRef') listRef!: ElementRef<HTMLUListElement>;

onEnter(event: KeyboardEvent, index: number): void {
  event.preventDefault();
  const points = [...this.alerts().points];
  points.splice(index + 1, 0, '');
  this.travel.updateDayField({ alerts: { ...this.alerts(), points } });

  // focus sur la nouvelle ligne après render
  setTimeout(() => {
    const items = this.listRef.nativeElement.querySelectorAll('li');
    (items[index + 1] as HTMLElement)?.focus();
  });
}

onBackspace(event: KeyboardEvent, index: number): void {
  const li = event.target as HTMLElement;
  if (li.innerText.trim() !== '') return; // ligne non vide, comportement normal

  event.preventDefault();
  if (index === 0 && this.alerts().points.length === 1) return; // garder au moins une ligne

  const points = this.alerts().points.filter((_, i) => i !== index);
  this.travel.updateDayField({ alerts: { ...this.alerts(), points } });

  // focus sur la ligne du dessus
  setTimeout(() => {
    const items = this.listRef.nativeElement.querySelectorAll('li');
    const target = items[index - 1] ?? items[0];
    (target as HTMLElement)?.focus();
      // place le curseur à la fin
  const range = document.createRange();
  const sel = window.getSelection();
  range.selectNodeContents(target);
  range.collapse(false); // false = fin
  sel?.removeAllRanges();
  sel?.addRange(range);
  });
}
  updateTitle(title: string): void {
  this.travel.updateDayField({ alerts: { ...this.alerts(), title } });
}

addPoint(): void {
  this.travel.updateDayField({
    alerts: { ...this.alerts(), points: [...this.alerts().points, 'Nouveau point'] }
  });
}

deletePoint(index: number): void {
  this.travel.updateDayField({
    alerts: { ...this.alerts(), points: this.alerts().points.filter((_, i) => i !== index) }
  });
}

updatePoint(index: number, value: string): void {
  const points = this.alerts().points.map((p, i) => i === index ? value : p);
  this.travel.updateDayField({ alerts: { ...this.alerts(), points } });
}
}

