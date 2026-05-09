import { Component, input } from '@angular/core';
import { InfoElement } from '../../../core/models/travel.models';
import { SafeHtmlPipe } from '../../../shared/pipes/safe-html.pipe';

@Component({
  selector: 'app-info-box',
  standalone: true,
  imports: [SafeHtmlPipe],
  template: `
    <div class="info-box">
      <div class="info-box-title">{{ element().title }}</div>
      <div class="info-box-body">
        <ul>
          @for (item of element().items; track $index) {
            <li [innerHTML]="item | safeHtml"></li>
          }
        </ul>
      </div>
    </div>
  `,
})
export class InfoBoxComponent {
  readonly element = input.required<InfoElement>();
}
