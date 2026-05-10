import { afterNextRender, Component, computed, effect, ElementRef, inject, input, signal  } from '@angular/core';
import { Activity, GridItem } from '../../../core/models/travel.models';
import { TabService } from '../../../core/services/tab.service';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-activity',
  standalone: true,
  imports:[ButtonModule ],
  templateUrl: 'activity.component.html',
  styleUrl:'activity.component.scss'
})
export class ActivityComponent {
  private readonly travel = inject(TabService);
  readonly activity = input.required<Activity>();
  readonly idSlot = input.required<number>();

  readonly gridItems = signal<GridItem[]>([]);

  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  private suppressBlur = false;
  // activity.component.ts
  readonly uploading = signal(false);
  readonly notesValue = signal('');

  constructor() {
 // S'exécute une seule fois à l'init
  afterNextRender(() => {
    const grid = this.activity().grid ?? [];
    this.gridItems.set(this.normalizeGrid(grid));
  });
  effect(() => {
      this.notesValue.set(this.activity().notes ?? '');
    });
}

  private removeTimeout: ReturnType<typeof setTimeout> | null = null;
  isPendingRemove = signal(false);

  countdown = signal(5);
  private countdownInterval: ReturnType<typeof setInterval> | null = null;


   patch(partial: Partial<Activity>): void {
    this.travel.updateActivityField(this.idSlot(), this.activity().id, partial);
  }

  patchTransport(key: 'icon' | 'text', value: string): void {
    const transport = { ...(this.activity().transport ?? { icon: '', text: '' }), [key]: value };
    this.patch({ transport });  // toujours persister, même vide
  }

onEnter(event: KeyboardEvent, id: string): void {
  event.preventDefault();
  const grid = [...this.gridItems()];
  const index = grid.findIndex(item => item.id === id);
  grid.splice(index + 1, 0, { id: crypto.randomUUID(), label: '', value: '' });
  this.gridItems.set(grid);         // ← local
  this.patch({ grid });             // ← Firestore
  requestAnimationFrame(() => this.focusField(index + 1, 'label'));
}

onBackspace(event: KeyboardEvent, id: string, key: 'label' | 'value'): void {
  const el = event.target as HTMLInputElement;
  if (el.value.trim() !== '') return;
  event.preventDefault();
  this.suppressBlur = true;

  const grid = this.gridItems();
  const index = grid.findIndex(item => item.id === id);

  if (key === 'value') {
    this.focusField(index, 'label');
    this.suppressBlur = false;
    return;
  }

  if (grid.length === 1) { this.suppressBlur = false; return; }

  const updated = grid.filter(item => item.id !== id);
  this.gridItems.set(updated);      // ← local
  this.patch({ grid: updated });    // ← Firestore
  setTimeout(() => {
    this.focusField(index - 1, 'value');
    this.suppressBlur = false;
  });
}

updateGridItem(id: string, key: 'label' | 'value', value: string): void {
  if (this.suppressBlur) return;
  const updated = this.gridItems().map(item =>
    item.id === id ? { ...item, [key]: value } : item
  );
  this.gridItems.set(updated);      // ← local
  this.patch({ grid: updated });    // ← Firestore
}

private focusField(index: number, key: 'label' | 'value'): void {
  const selector = key === 'label' ? '.act-grid-label' : '.act-grid-value';
  
  requestAnimationFrame(() => {
    const inputs = this.el.nativeElement.querySelectorAll<HTMLInputElement>(selector);
    const input = inputs[index];
    if (!input) return;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  });
}


  async onFileSelected(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploading.set(true);
    try {
      await this.travel.uploadActivityFile(this.idSlot(), this.activity().id, file);
    } finally {
      this.uploading.set(false);
    }
  }
  async removeFile(){
    this.travel.removeActivityFile(this.idSlot(), this.activity().id, '');
  }

  onNotesBlur(): void {
    this.travel.updateActivityField(this.idSlot(), this.activity().id, {notes :this.notesValue()});
  }

 removeActivite() {
  this.isPendingRemove.set(true);
  this.countdown.set(5);

  this.countdownInterval = setInterval(() => {
    this.countdown.update(v => v - 1);
  }, 1000);

  this.removeTimeout = setTimeout(async () => {
    clearInterval(this.countdownInterval!);
    this.isPendingRemove.set(false);
    this.travel.removeActivity(this.idSlot(), this.activity().id);
  }, 5000);
}

cancelRemove() {
  clearTimeout(this.removeTimeout!);
  clearInterval(this.countdownInterval!);
  this.removeTimeout = null;
  this.isPendingRemove.set(false);
}

private normalizeGrid(grid: GridItem[]): GridItem[] {
  return grid.map(item => ({ ...item, id: item.id ?? crypto.randomUUID() }));
}
}
