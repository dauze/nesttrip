import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { tap } from 'rxjs/operators';
import { ChipComponent } from '@app/shared/components/chip/chip.component';
import { ButtonComponent } from '@app/shared/components/button/button.component';
import { ProgressSpinnerComponent } from '@app/shared/components/progress-spinner/progress-spinner.component';
import { FileService } from '@core/services/file.service';
import { fileIcon as fileIconFor, openFile as openFileUrl } from '@app/shared/utils/file-icon';
import { ALLOWED_FILE_EXTENSIONS, MAX_FILE_SIZE_BYTES } from '@app/shared/utils/input-limits';
import { ConfirmDialogService } from '@app/shared/services/confirm-dialog.service';

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
  private readonly confirmDialogService = inject(ConfirmDialogService);

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
      if (file.size > MAX_FILE_SIZE_BYTES) {
        this.confirmDialogService.confirm({
          header: 'Fichier trop volumineux',
          message: `"${file.name}" dépasse la taille maximale autorisée (10 Mo).`,
          icon: 'pi pi-exclamation-triangle',
          acceptLabel: 'OK',
          singleButton: true,
        });
        continue;
      }

      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!ext || !ALLOWED_FILE_EXTENSIONS.includes(ext)) {
        this.confirmDialogService.confirm({
          header: 'Type de fichier non supporté',
          message: `"${file.name}" n'est pas un type de fichier accepté (${ALLOWED_FILE_EXTENSIONS.join(', ')}).`,
          icon: 'pi pi-exclamation-triangle',
          acceptLabel: 'OK',
          singleButton: true,
        });
        continue;
      }

      // Retire tout séparateur de chemin du nom de fichier : sans ça un nom malveillant
      // pourrait créer des sous-dossiers imprévus sous le préfixe du trip (audit de sécurité).
      const safeName = file.name.replace(/[/\\]/g, '_');
      const path = `${this.storagePathPrefix()}/${safeName}`;
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
    openFileUrl(file);
  }

  fileIcon(name: string): string {
    return fileIconFor(name);
  }

  private stopUploading(name: string): void {
    this.uploadingFiles.update((s) => { const n = new Set(s); n.delete(name); return n; });
  }
}
