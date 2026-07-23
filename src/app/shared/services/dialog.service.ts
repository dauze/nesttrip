import { Injectable, inject } from '@angular/core';
import { Dialog, DialogConfig, DialogRef } from '@angular/cdk/dialog';
import { ComponentType } from '@angular/cdk/portal';

function mergeClasses(base: string, extra: string | string[] | undefined): string[] {
  if (!extra) return [base];
  return [base, ...(Array.isArray(extra) ? extra : [extra])];
}

/**
 * Point d'entrée unique pour ouvrir un dialog maison (Phase 2 de la sortie
 * de PrimeNG, voir PRIMENG_MIGRATION.md). Fine couche au-dessus de
 * `@angular/cdk/dialog` : focus-trap, ARIA, fermeture Echap/backdrop et
 * restauration du focus sont gérés par le CDK, on ne pose ici que nos
 * classes/valeurs par défaut (voir `.app-dialog-panel`/`.app-dialog-backdrop`
 * dans src/styles/dialog.scss).
 *
 * Le composant ouvert construit typiquement son contenu avec
 * `<app-dialog-frame>` et ferme le dialog via `DialogRef.close()` (injecté).
 */
@Injectable({ providedIn: 'root' })
export class DialogService {
  private readonly dialog = inject(Dialog);

  open<R = unknown, D = unknown, C = unknown>(
    component: ComponentType<C>,
    config?: DialogConfig<D, DialogRef<R, C>>,
  ): DialogRef<R, C> {
    return this.dialog.open<R, D, C>(component, {
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      closeOnNavigation: true,
      ...config,
      panelClass: mergeClasses('app-dialog-panel', config?.panelClass),
      backdropClass: mergeClasses('app-dialog-backdrop', config?.backdropClass),
    });
  }

  closeAll(): void {
    this.dialog.closeAll();
  }
}
