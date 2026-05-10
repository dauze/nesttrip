import { Component, computed, effect, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { Activity } from '../../../core/models/travel.models';
import { TabService } from '../../../core/services/tab.service';

@Component({
  selector: 'app-activity',
  standalone: true,
  templateUrl: 'activity.component.html',
  styleUrl:'activity.component.scss'
})
export class ActivityComponent {
  private readonly travel = inject(TabService);
  readonly activity = input.required<Activity>();
  readonly idSlot = input.required<number>();

  // activity.component.ts
  readonly uploading = signal(false);
  readonly notesValue = signal('');

   // Copie locale du grid pour l'édition
  readonly gridItems = computed(() => [...(this.activity().grid ?? [])]);

  constructor() {
    effect(() => {
      this.notesValue.set(this.activity().notes ?? '');
    });
  }
   patch(partial: Partial<Activity>): void {
    this.travel.updateActivityField(this.idSlot(), this.activity().id, partial);
  }

  patchTransport(key: 'icon' | 'text', value: string): void {
    const transport = { ...(this.activity().transport ?? { icon: '', text: '' }), [key]: value };
    this.patch({ transport: transport.text || transport.icon ? transport : undefined });
  }

  updateGridItem(index: number, key: 'label' | 'value', value: string): void {
    const grid = (this.activity().grid ?? []).map((item, i) =>
      i === index ? { ...item, [key]: value } : item
    );
    this.patch({ grid });
  }

  onEnter(event: KeyboardEvent, index: number): void {
  event.preventDefault();
  const grid = [...(this.activity().grid ?? [])];
  grid.splice(index + 1, 0, { label: '', value: '' });
  this.patch({ grid });

  setTimeout(() => this.focusField(index + 1, 'label'));
}

onBackspace(event: KeyboardEvent, index: number, key: 'label' | 'value'): void {
  const el = event.target as HTMLInputElement;
  if (el.value.trim() !== '') return;

  event.preventDefault();

  if (key === 'value') {
    this.focusField(index, 'label');
    return;
  }

  // key === 'label' : supprimer la ligne si les deux champs sont vides
  const grid = this.activity().grid ?? [];
  if (grid.length === 1) return;

  this.patch({ grid: grid.filter((_, i) => i !== index) });
  setTimeout(() => this.focusField(index - 1, 'value'));
}

private focusField(index: number, key: 'label' | 'value'): void {
  const selector = key === 'label' ? '.act-grid-label' : '.act-grid-value';
  const input = document.querySelectorAll<HTMLInputElement>(selector)[index];
  if (!input) return;
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
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

  async removeActivite(){
     this.travel.removeActivity(this.idSlot(),this.activity().id);
  }
}
