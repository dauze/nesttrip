import { ChangeDetectionStrategy, Component, ViewContainerRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Logistic, LogisticDateTimeField } from '@core/models/logistic.dto';
import { LOGISTIC_TYPE_META } from '../../logistic.constants';
import { DialogService } from '@app/shared/services/dialog.service';
import { PlaceSummary } from '@core/models/place.dto';
import {
  TitleEditDialogComponent,
  TitleEditDialogData,
  TitleEditDialogResult,
} from '@app/shared/components/activity-card/activity-header/title-edit-dialog/title-edit-dialog.component';
import {
  SimpleTextEntryDialogComponent,
  SimpleTextEntryDialogData,
} from '@app/shared/components/overlays/simple-text-entry-dialog/simple-text-entry-dialog.component';

/**
 * Header d'une carte réservation : icône du type + titre. Titre toujours en
 * lecture seule + crayon dédié (voir ROADMAP.md "UX / Interactions",
 * uniformisé le 2026-07-31 — auparavant seuls Vol/Train avaient ce pattern,
 * Logement était un bouton pleine largeur et Location voiture/Autre un champ
 * texte édité inline) :
 * - `'logement'` : pas de champ "adresse" séparé, le crayon rouvre
 *   `TitleEditDialogComponent` (texte libre OU sélection Google), qui remonte
 *   soit un nouveau titre seul, soit un titre + un `PlaceSummary` complet.
 * - `'flight'`/`'train'` : titre calculé automatiquement par la cinématique
 *   guidée (ex. "Vol (AF1234) - CDG - JFK") — le crayon ouvre
 *   `SimpleTextEntryDialogComponent` pour l'écraser manuellement si besoin.
 * - `'carRental'`/`'other'` : texte libre, même dialog que Vol/Train
 *   (`openTitleTextDialog`) au lieu d'un champ édité inline.
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
  /** Clic sur une date/heure (voir ROADMAP.md "UX / Interactions") : `LogisticCardComponent` déplie la carte et ouvre le picker correspondant du form. */
  readonly dateTimeClicked = output<LogisticDateTimeField>();

  readonly typeMeta = LOGISTIC_TYPE_META;
  readonly isLogement = computed(() => this.logistic().type === 'logement');

  /**
   * Valeur locale découplée du signal `logistic` — le titre peut être posé
   * de l'EXTÉRIEUR de ce composant à tout moment par la cinématique guidée
   * de `LogisticDetailsComponent` (`applyTitle`/`onPlaceSelected`, un
   * composant frère), donc un simple `input()` ne suffit pas. Pas de
   * garde-fou "saisie en cours" nécessaire ici (contrairement à
   * `ActivityHeaderComponent.titleControl`) : l'édition passe désormais
   * toujours par un dialog (voir la doc de classe), qui garde son propre
   * brouillon local tant qu'il est ouvert — jamais de frappe en direct dans
   * ce composant qu'un snapshot distant pourrait écraser.
   */
  readonly titleValue = signal('');

  constructor() {
    effect(() => this.titleValue.set(this.logistic().title));
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

  /** Tous les types sauf Logement (voir isLogement) : titre libre ou calculé (Vol/Train) édité via un simple champ texte, sans recherche Google. */
  openTitleTextDialog(event: Event): void {
    event.stopPropagation();

    const dialogRef = this.dialogService.open<string | undefined, SimpleTextEntryDialogData>(
      SimpleTextEntryDialogComponent,
      {
        data: { initialValue: this.titleValue(), placeholder: this.typeMeta[this.logistic().type].label, title: 'Titre', optional: true },
        panelClass: 'app-wide-dialog-panel',
        viewContainerRef: this.viewContainerRef,
        // Même correctif que openLogementTitleDialog ci-dessus (retour utilisateur, 2026-08-02).
        autoFocus: '.simple-text-entry-dialog__input',
      },
    );

    dialogRef.closed.subscribe((result) => {
      if (result === undefined) return;
      this.titleValue.set(result);
      this.titleEdited.emit(result);
    });
  }

  /** `stopPropagation` : même besoin que le crayon ci-dessus — sans ça, le clic remonterait au header et déplierait/replierait le panneau au lieu d'ouvrir le picker. */
  onDateTimeClick(event: Event, field: LogisticDateTimeField): void {
    event.stopPropagation();
    this.dateTimeClicked.emit(field);
  }
}
