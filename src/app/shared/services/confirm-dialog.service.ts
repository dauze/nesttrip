import { Injectable, inject } from '@angular/core';
import { DialogService } from '@app/shared/services/dialog.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '@app/shared/components/confirm-dialog/confirm-dialog.component';

export interface ConfirmOptions extends ConfirmDialogData {
  accept?: () => void;
  reject?: () => void;
}

/**
 * Remplacement maison de `ConfirmationService`/`p-confirmDialog` (Phase 7c
 * de la sortie de PrimeNG, voir PRIMENG_MIGRATION.md). Singleton unique
 * (`providedIn: 'root'`) plutôt qu'un provider par composant hôte comme
 * PrimeNG (`accueil-trip`/`trip-detail` fournissaient chacun leur propre
 * instance, chacune couplée à son propre `<p-confirmDialog />` monté dans le
 * template) : `DialogService.open()` crée le contenu dynamiquement via CDK,
 * il n'y a donc plus besoin d'un hôte pré-monté par arbre de composants.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private readonly dialogService = inject(DialogService);

  confirm(options: ConfirmOptions): void {
    const { accept, reject, ...data } = options;
    const dialogRef = this.dialogService.open<boolean, ConfirmDialogData>(ConfirmDialogComponent, { data });
    dialogRef.closed.subscribe((confirmed) => {
      if (confirmed) accept?.();
      else reject?.();
    });
  }
}
