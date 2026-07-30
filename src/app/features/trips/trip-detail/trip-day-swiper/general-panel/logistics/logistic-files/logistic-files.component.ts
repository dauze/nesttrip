import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { tap } from 'rxjs/operators';
import { ChipComponent } from '@app/shared/components/chip/chip.component';
import { ButtonComponent } from '@app/shared/components/button/button.component';
import { ProgressSpinnerComponent } from '@app/shared/components/progress-spinner/progress-spinner.component';
import { FileService } from '@core/services/file.service';
import { TripFacade } from '@app/features/trips/trip-facade.service';
import { Logistic, LogisticFile } from '@core/models/logistic.dto';

/**
 * Upload/suppression de fichiers d'une réservation — copie de
 * `ActivityFilesComponent` adaptée : pas d'indirection pool/instance ici
 * (une réservation est une entité plate), le chemin de stockage cible donc
 * directement `logistic().id`.
 */
@Component({
  selector: 'app-logistic-files',
  standalone: true,
  imports: [ChipComponent, ButtonComponent, ProgressSpinnerComponent],
  templateUrl: './logistic-files.component.html',
  styleUrl: './logistic-files.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogisticFilesComponent {
  private readonly fileService = inject(FileService);
  private readonly tripFacade = inject(TripFacade);

  readonly tripId = input.required<string>();
  readonly logistic = input.required<Logistic>();

  readonly uploadingFiles = signal<Set<string>>(new Set());

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    input.value = '';

    const logistic = this.logistic();

    for (const file of files) {
      const path = `trips/${this.tripId()}/logistics/${logistic.id}/${file.name}`;
      this.uploadingFiles.update((s) => new Set(s).add(file.name));

      this.fileService.uploadFile(file, path).pipe(
        tap(({ url, name }) => {
          this.tripFacade.updateLogistic(this.tripId(), {
            ...logistic,
            files: [...(logistic.files ?? []), { name, url, path }],
          });
        }),
      ).subscribe({
        complete: () => this.stopUploading(file.name),
        error: () => this.stopUploading(file.name),
      });
    }
  }

  removeFile(index: number): void {
    const logistic = this.logistic();
    const file = logistic.files[index];
    this.fileService.deleteFile(file.path).pipe(
      tap(() => {
        this.tripFacade.updateLogistic(this.tripId(), {
          ...logistic,
          files: logistic.files.filter((_, i) => i !== index),
        });
      }),
    ).subscribe();
  }

  openFile(file: LogisticFile): void {
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
