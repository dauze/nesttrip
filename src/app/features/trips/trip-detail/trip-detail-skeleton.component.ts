import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { SkeletonModule } from 'primeng/skeleton';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-trip-detail-skeleton',
  standalone: true,
  imports: [SkeletonModule, CommonModule],
  templateUrl: './trip-detail-skeleton.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripDetailSkeletonComponent {
  readonly count = input<number>(3);
  readonly panels = Array.from({ length: 3 }, (_, i) => ({
    titleWidth: ['60%', '40%', '55%'][i],
    rows: [3, 4, 2][i],
    hasCheckbox: [true, false, false][i],
  }));
}