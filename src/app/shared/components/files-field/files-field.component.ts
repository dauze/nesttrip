import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { tap } from 'rxjs/operators';
import { ChipComponent } from '@app/shared/components/chip/chip.component';
import { ButtonComponent } from '@app/shared/components/button/button.component';
import { ProgressSpinnerComponent } from '@app/shared/components/progress-spinner/progress-spinner.component';
import { FileService } from '@core/services/file.service';

export interface FileRef {
  url: string;
  name: string;
  path: string;
}

/**
 * Champ fichiers réutilisable (upload/liste/suppression) — remplace
 * `ActivityFilesComponent`/`LogisticFilesComponent`, deux copies quasi
 * identiques (ROADMAP.md "### UI"/"Qualité", "le composant est dupliqué à
 * tort"). Ne connaît AUCUNE spécificité de persistance (pool d'activité vs
 * réservation logistique) : reçoit `files`/`storagePathPrefix`, émet
 * `filesChange` avec le nouveau tableau complet — c'est à l'appelant
 * (`ActivityCardComponent`/`LogisticCardComponent`) de persister via son
 * propre appel de façade (`updatePoolActivity`/`updateLogistic`).
 */
@Component({
  selector: 'app-files-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChipComponent, ButtonComponent, ProgressSpinnerComponent],
  templateUrl: './files-field.component.html',
  styleUrl: './files-field.component.scss',
})
export class FilesFieldComponent {
  private readonly fileService = inject(FileService);

  readonly files = input.required<FileRef[]>();
  /** Préfixe de chemin Storage SANS le nom de fichier final (ex. `trips/{tripId}/{activityId}`, `trips/{tripId}/logistics/{logisticId}`) — voir chaque appelant. */
  readonly storagePathPrefix = input.required<string>();
  readonly filesChange = output<FileRef[]>();

  readonly uploadingFiles = signal<Set<string>>(new Set());

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const selected = input.files ? Array.from(input.files) : [];
    // Remise à zéro immédiate : sans ça, resélectionner le(s) même(s)
    // fichier(s) juste après ne redéclencherait pas `change` (le navigateur
    // considère la valeur de l'input inchangée).
    input.value = '';

    for (const file of selected) {
      const path = `${this.storagePathPrefix()}/${file.name}`;
      this.uploadingFiles.update((s) => new Set(s).add(file.name));

      this.fileService.uploadFile(file, path).pipe(
        tap(({ url, name }) => {
          this.filesChange.emit([...this.files(), { name, url, path }]);
        }),
      ).subscribe({
        complete: () => this.stopUploading(file.name),
        error: () => this.stopUploading(file.name),
      });
    }
  }

  removeFile(index: number): void {
    const file = this.files()[index];
    this.fileService.deleteFile(file.path).pipe(
      tap(() => {
        this.filesChange.emit(this.files().filter((_, i) => i !== index));
      }),
    ).subscribe();
  }

  openFile(file: FileRef): void {
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
