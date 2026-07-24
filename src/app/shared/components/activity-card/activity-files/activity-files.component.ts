import { Component, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChipComponent } from '@app/shared/components/chip/chip.component';
import { ButtonComponent } from '@app/shared/components/button/button.component';
import { ProgressSpinnerComponent } from '@app/shared/components/progress-spinner/progress-spinner.component';
import { tap } from 'rxjs/operators';

import { FileService } from '@core/services/file.service';
import { TripFacade } from '@app/features/trips/trip-facade.service';
import { Activity, ActivityFile } from '../activity.model';

@Component({
  selector: 'app-activity-files',
  standalone: true,
  imports: [CommonModule, ChipComponent, ButtonComponent, ProgressSpinnerComponent],
  templateUrl: './activity-files.component.html',
  styleUrl: './activity-files.component.scss',
})
export class ActivityFilesComponent {
  private readonly fileService = inject(FileService);
  private readonly tripFacade = inject(TripFacade);

  readonly tripId = input.required<string>();
  readonly activity = input.required<Activity>();

  readonly uploadingFiles = signal<Set<string>>(new Set());

  /**
   * Les fichiers vivent uniquement sur l'activité de pool (jamais dupliqués
   * par instance/jour) : le chemin de stockage et les écritures ciblent
   * toujours `activity().activityId`, jamais `activity().id` (qui est un
   * instanceId en contexte jour).
   */
  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    // Remise à zéro immédiate : sans ça, resélectionner le(s) même(s)
    // fichier(s) juste après ne redéclencherait pas `change` (le navigateur
    // considère la valeur de l'input inchangée).
    input.value = '';

    const activity = this.activity();

    for (const file of files) {
      const path = `trips/${this.tripId()}/${activity.activityId}/${file.name}`;
      this.uploadingFiles.update((s) => new Set(s).add(file.name));

      this.fileService.uploadFile(file, path).pipe(
        tap(({ url, name }) => {
          this.tripFacade.updatePoolActivity(this.tripId(), {
            id: activity.activityId,
            title: activity.title,
            placeId: activity.placeId,
            address: activity.address,
            latitude: activity.latitude,
            longitude: activity.longitude,
            photoRefs: activity.photoRefs,
            files: [...(activity.files ?? []), { name, url, path }],
          });
        }),
      ).subscribe({
        complete: () => this.stopUploading(file.name),
        error: () => this.stopUploading(file.name),
      });
    }
  }

  removeFile(index: number): void {
    const activity = this.activity();
    const file = activity.files![index];
    this.fileService.deleteFile(file.path).pipe(
      tap(() => {
        this.tripFacade.updatePoolActivity(this.tripId(), {
          id: activity.activityId,
          title: activity.title,
          placeId: activity.placeId,
          address: activity.address,
          latitude: activity.latitude,
          longitude: activity.longitude,
          photoRefs: activity.photoRefs,
          files: (activity.files ?? []).filter((_, i) => i !== index),
        });
      }),
    ).subscribe();
  }

  openFile(file: ActivityFile): void {
    window.open(file.url, '_blank', 'noopener');
  }

  fileIcon(name: string): string {
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    const map: Record<string, string> = {
      pdf: 'pi-file-pdf',
      jpg: 'pi-image', jpeg: 'pi-image', png: 'pi-image', webp: 'pi-image',
      doc: 'pi-file-word', docx: 'pi-file-word',
    };
    return `pi ${map[ext] ?? 'pi-file'}`;
  }

  private stopUploading(name: string): void {
    this.uploadingFiles.update((s) => { const n = new Set(s); n.delete(name); return n; });
  }
}