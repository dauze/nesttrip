import { ChangeDetectionStrategy, Component, ViewContainerRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Logistic } from '@core/models/logistic.dto';
import { LOGISTIC_TYPE_META } from '../../logistic.constants';
import { DialogService } from '@app/shared/services/dialog.service';
import { PlaceSummary } from '@core/models/place.dto';
import {
  TitleEditDialogComponent,
  TitleEditDialogData,
  TitleEditDialogResult,
} from '@app/shared/components/activity-card/activity-header/title-edit-dialog/title-edit-dialog.component';

/**
 * Header d'une carte réservation : icône du type + titre. Texte libre pour
 * tous les types SAUF `'logement'` — le lieu Google d'un logement n'a plus de
 * champ "adresse" séparé (voir ROADMAP.md, ex-`LogementFieldsComponent`
 * supprimé, doublon avec le titre) : cliquer sur le titre d'un logement rouvre
 * `TitleEditDialogComponent` (texte libre OU sélection Google), qui remonte
 * soit un nouveau titre seul, soit un titre + un `PlaceSummary` complet.
 */
@Component({
  selector: 'app-logistic-header',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './logistic-header.component.html',
  styleUrl: './logistic-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogisticHeaderComponent {
  private readonly dialogService = inject(DialogService);
  private readonly viewContainerRef = inject(ViewContainerRef);

  readonly logistic = input.required<Logistic>();
  readonly titleEdited = output<string>();
  /** Émis uniquement quand le titre d'un logement est édité via une vraie sélection Google (voir le dialog ci-dessus). */
  readonly placeSelected = output<PlaceSummary>();

  readonly typeMeta = LOGISTIC_TYPE_META;
  readonly isLogement = computed(() => this.logistic().type === 'logement');

  /**
   * Valeur locale découplée du signal `logistic` — un snapshot distant reçu
   * pendant la frappe ne doit jamais écraser une saisie en cours (même
   * garde-fou que `ActivityHeaderComponent.titleControl`/
   * `LogisticDetailsComponent.hasUnflushedLocalEdit`). Contrairement à un
   * simple `runOnceReady` (qui ne synchronise qu'une seule fois, à la toute
   * première valeur) : le titre peut être posé de l'EXTÉRIEUR de ce
   * composant à tout moment par la cinématique guidée de
   * `LogisticDetailsComponent` (`applyTitle`/`onPlaceSelected`, un composant
   * frère) — `runOnceReady` seul laissait alors le bouton/l'input figé sur
   * sa valeur de création (souvent vide), jamais mis à jour par la suite.
   */
  readonly titleValue = signal('');

  private hasUnflushedLocalEdit = false;
  private lastSyncedLogisticId: string | undefined;

  constructor() {
    effect(() => {
      const r = this.logistic();
      if (this.hasUnflushedLocalEdit && r.id === this.lastSyncedLogisticId) return;
      this.lastSyncedLogisticId = r.id;
      this.titleValue.set(r.title);
    });
  }

  onTitleInput(value: string): void {
    this.hasUnflushedLocalEdit = true;
    this.titleValue.set(value);
  }

  onTitleBlur(): void {
    this.hasUnflushedLocalEdit = false;
    const trimmed = this.titleValue().trim();
    if (this.logistic().title === trimmed) return;
    this.titleEdited.emit(trimmed);
  }

  /**
   * Laisse le clavier virtuel finir son animation d'ouverture avant de
   * scroller (sinon le calcul de position utilise encore la hauteur de
   * viewport d'avant clavier et le champ reste caché dessous) — même délai
   * que `PANEL_COLLAPSE_DELAY_MS` ailleurs dans le projet pour la même
   * raison (attendre la fin d'une animation avant de mesurer/agir).
   */
  onTitleFocus(event: FocusEvent): void {
    const target = event.target as HTMLElement;
    setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
  }

  /** Logement uniquement (voir isLogement) : ouvre le même dialog titre-ou-lieu-Google que pour une activité, au lieu de l'édition inline. */
  openLogementTitleDialog(event: Event): void {
    event.stopPropagation();

    const dialogRef = this.dialogService.open<TitleEditDialogResult | undefined, TitleEditDialogData>(
      TitleEditDialogComponent,
      {
        data: { initialTitle: this.titleValue(), placeholder: 'Nom du logement', title: 'Nom' },
        panelClass: 'app-wide-dialog-panel',
        viewContainerRef: this.viewContainerRef,
        // Sans ça, l'autofocus CDK par défaut ('first-tabbable') cible le
        // bouton de fermeture (1er élément focusable du template), pas le
        // champ — même correctif que LogisticDetailsComponent.openTitleDialog.
        autoFocus: '.title-edit-dialog__input',
      },
    );

    dialogRef.closed.subscribe((result) => {
      if (!result) return;

      if (result.type === 'place') {
        this.titleValue.set(result.place.name);
        this.titleEdited.emit(result.place.name);
        this.placeSelected.emit(result.place);
        return;
      }

      this.titleValue.set(result.text);
      this.titleEdited.emit(result.text);
    });
  }
}
