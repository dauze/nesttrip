import { Component, inject } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ButtonComponent } from '@app/shared/components/button/button.component';
import { DialogFrameComponent } from '@app/shared/components/dialog-frame/dialog-frame.component';

export interface ConfirmDialogData {
  message: string;
  header?: string;
  icon?: string;
  acceptLabel?: string;
  rejectLabel?: string;
}

/**
 * Contenu ouvert par `ConfirmDialogService` (Phase 7c de la sortie de
 * PrimeNG, voir PRIMENG_MIGRATION.md) — remplace `p-confirmDialog` +
 * `ConfirmationService`. `DialogRef.close(true)`/`close(false)` communique
 * le choix ; le service traduit ça en `accept()`/`reject()`. Une
 * fermeture par Échap/clic extérieur (CDK, activé par défaut) ferme avec
 * `undefined`, traité côté service comme un refus — cohérent avec le seul
 * usage d'un `reject` explicite (annulation des dates dans trip-detail).
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [ButtonComponent, DialogFrameComponent],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
})
export class ConfirmDialogComponent {
  protected readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);
  protected readonly data = inject<ConfirmDialogData>(DIALOG_DATA);

  protected accept(): void {
    this.dialogRef.close(true);
  }

  protected reject(): void {
    this.dialogRef.close(false);
  }
}
