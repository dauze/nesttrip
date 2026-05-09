import { Component, effect, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { Activity } from '../../../core/models/travel.models';
import { TabService } from '../../../core/services/tab.service';
import { StorageService } from '../../../core/services/storage.service';

@Component({
  selector: 'app-activity',
  standalone: true,
  templateUrl: 'activity.component.html',
  styleUrl:'activity.component.scss'
})
export class ActivityComponent {
  private readonly travel = inject(TabService);
  private readonly storageService = inject(StorageService);

  readonly activity = input.required<Activity>();
  readonly idSlot = input.required<number>();

  // activity.component.ts
  readonly uploading = signal(false);
  // pour le delete
  private fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  readonly notesValue = signal('');

  constructor() {
    effect(() => {
      this.notesValue.set(this.activity().notes ?? '');
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
    this.storageService.deleteFile(this.activity().fileUrl ?? '');
  }

  onNotesBlur(): void {
    this.travel.updateActivityField(this.idSlot(), this.activity().id, {notes :this.notesValue()});
  }
}
