import { Component, effect, inject, input, signal } from '@angular/core';
import { InfoElement } from '../../../core/models/travel.models';
import { SafeHtmlPipe } from '../../../shared/pipes/safe-html.pipe';
import { TabService } from '../../../core/services/tab.service';

@Component({
  selector: 'app-info-box',
  standalone: true,
  imports: [SafeHtmlPipe],
  templateUrl: 'info-box.component.html'
})
export class InfoBoxComponent {
  private readonly travel = inject(TabService);
  readonly element = input.required<InfoElement>();

  readonly todoCustom = signal('');

  constructor() {
    effect(() => {
      this.todoCustom.set(this.element().items.join('\n') ?? '');
    });
  }

  onElementsBlur(): void {
    this.travel.updateElement(this.todoCustom().split('\n'));
  }
}
