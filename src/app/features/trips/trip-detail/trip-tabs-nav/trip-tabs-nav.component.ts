import { Component, ElementRef, input, output, viewChild } from '@angular/core';
import { TabsModule } from 'primeng/tabs';
import { TripTab } from '../trip-tab.model';

@Component({
  selector: 'app-trip-tabs-nav',
  standalone: true,
  imports: [TabsModule],
  templateUrl: './trip-tabs-nav.component.html',
  styleUrl: './trip-tabs-nav.component.scss',
})
export class TripTabsNavComponent {
  readonly tabs = input<TripTab[]>([]);
  readonly activeId = input<string>('');
  readonly tabSelected = output<{ id: string; index: number }>();

 private readonly tabsListRef = viewChild('tabsListRef', { read: ElementRef });
 
  protected onTabClick(id: string, index: number): void {
    this.tabSelected.emit({ id, index });
  }

  /** Appelée explicitement par le parent (clic sur tab ET swipe), comme dans la version d'origine. */
  scrollIntoView(index: number): void {
    requestAnimationFrame(() => {
      const tabs = this.tabsListRef()?.nativeElement.querySelectorAll('[role="tab"]');
      const el = tabs?.[index] as HTMLElement | undefined;
      el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    });
  }
}