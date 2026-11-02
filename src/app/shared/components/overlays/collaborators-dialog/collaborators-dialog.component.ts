import { ChangeDetectionStrategy, Component, Signal, computed, inject, signal } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { FormsModule } from '@angular/forms';
import { AvatarComponent } from '@app/shared/components/avatar/avatar/avatar.component';
import { TooltipDirective } from '@app/shared/directives/tooltip.directive';
import { ButtonComponent } from '@app/shared/components/actions/button/button.component';
import { DialogFrameComponent } from '@app/shared/components/overlays/dialog-frame/dialog-frame.component';
import { InputTextDirective } from '@app/shared/directives/input-text.directive';
import { MessageComponent } from '@app/shared/components/feedback/message/message.component';
import { TripMember } from '@app/features/trips/trip.model';
import { Companion } from '@app/core/models/user-profile.dto';
import { getInitials } from '@app/shared/utils/get-initials';
import { ViewportService } from '@app/core/services/ui/viewport.service';
import { LongPressDirective } from '@app/shared/directives/long-press.directive';

/**
 * Signaux (pas des valeurs figées) + callbacks : voir la doc de
 * `TripCollaboratorsComponent.openDialog` sur pourquoi ce contenu, ouvert
 * dynamiquement via `DialogService` (donc hors de l'arbre de vue de l'appelant),
 * a besoin de rester réactif aux membres/companions/addLoading/addError.
 */
export interface CollaboratorsDialogData {
  tripTitle: Signal<string>;
  members: Signal<Record<string, TripMember>>;
  currentUserId: Signal<string>;
  isOwner: Signal<boolean>;
  companions: Signal<Companion[]>;
  addLoading: Signal<boolean>;
  addError: Signal<string | null>;
  onAdd: (email: string) => void;
  onRemove: (uid: string) => void;
  onRemoveCompanion: (uid: string) => void;
}

/**
 * Pop-up « Voyageurs » (décision UX 2026-11-02, `.maquettes/voyageurs-dialog.html`) :
 * sépare qui a accès à CE voyage (membres) du carnet permanent « Mes proches »
 * (companions du profil), qui ne sert qu'à ajouter en un clic. Bottom sheet sur
 * mobile, 2 colonnes sur desktop (`.app-travellers-dialog-panel`, dialog.scss).
 */
@Component({
  selector: 'app-collaborators-dialog',
  standalone: true,
  imports: [FormsModule, AvatarComponent, TooltipDirective, ButtonComponent, DialogFrameComponent, InputTextDirective, MessageComponent, LongPressDirective],
  templateUrl: './collaborators-dialog.component.html',
  styleUrl: './collaborators-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollaboratorsDialogComponent {
  private readonly dialogRef = inject(DialogRef<void>);
  protected readonly data = inject<CollaboratorsDialogData>(DIALOG_DATA);
  protected readonly viewport = inject(ViewportService);

  protected inviteeEmail = '';

  protected readonly getInitials = getInitials;

  readonly memberEntries = computed(() => Object.entries(this.data.members()));

  readonly availableCompanions = computed(() => {
    const memberUids = new Set(Object.keys(this.data.members()));
    return this.data.companions().filter((c) => !memberUids.has(c.uid));
  });

  protected canRemove(uid: string): boolean {
    return this.data.isOwner() && uid !== this.data.currentUserId();
  }

  /** Proche dont la croix « Retirer de mes proches » est révélée par un appui long (tactile) ; au survol sur desktop. */
  protected readonly revealedCompanionUid = signal<string | null>(null);
  /** Le relâchement d'un appui long émet aussi un `click` : il ne doit pas ajouter. */
  private swallowNextChipClick = false;

  protected onCompanionLongPress(uid: string): void {
    this.revealedCompanionUid.set(uid);
    this.swallowNextChipClick = true;
  }

  /** Certains navigateurs n'émettent pas de `click` après un appui long : le drapeau ne doit pas survivre au geste suivant. */
  protected onChipPointerDown(): void {
    this.swallowNextChipClick = false;
  }

  protected submitInvite(): void {
    if (!this.inviteeEmail || this.data.addLoading()) return;
    this.data.onAdd(this.inviteeEmail);
    this.inviteeEmail = '';
  }

  protected onAddCompanion(companion: Companion): void {
    if (this.swallowNextChipClick) {
      this.swallowNextChipClick = false;
      return;
    }
    if (this.revealedCompanionUid() === companion.uid) {
      this.revealedCompanionUid.set(null);
      return;
    }
    this.revealedCompanionUid.set(null);
    this.data.onAdd(companion.email);
  }

  protected onRemove(uid: string): void {
    if (!this.canRemove(uid)) return;
    this.data.onRemove(uid);
  }

  protected onRemoveCompanionClick(event: Event, uid: string): void {
    event.stopPropagation();
    this.revealedCompanionUid.set(null);
    this.data.onRemoveCompanion(uid);
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
