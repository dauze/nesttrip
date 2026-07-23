import { Component, Signal, computed, inject } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { FormsModule } from '@angular/forms';
import { AvatarComponent } from '@app/shared/components/avatar/avatar.component';
import { TooltipDirective } from '@app/shared/directives/tooltip.directive';
import { ButtonComponent } from '@app/shared/components/button/button.component';
import { DialogFrameComponent } from '@app/shared/components/dialog-frame/dialog-frame.component';
import { InputTextDirective } from '@app/shared/directives/input-text.directive';
import { MessageComponent } from '@app/shared/components/message/message.component';
import { TripMember } from '@app/features/trips/trip.model';
import { Companion } from '@app/core/models/user-profile.dto';
import { getInitials } from '@app/shared/utils/get-initials';

/**
 * Signaux (pas des valeurs figées) + callbacks : voir la doc de
 * `TripCollaboratorsComponent.openDialog` sur pourquoi ce contenu, ouvert
 * dynamiquement via `DialogService` (donc hors de l'arbre de vue de l'appelant),
 * a besoin de rester réactif aux membres/companions/addLoading/addError.
 */
export interface CollaboratorsDialogData {
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

@Component({
  selector: 'app-collaborators-dialog',
  standalone: true,
  imports: [FormsModule, AvatarComponent, TooltipDirective, ButtonComponent, DialogFrameComponent, InputTextDirective, MessageComponent],
  templateUrl: './collaborators-dialog.component.html',
  styleUrl: './collaborators-dialog.component.scss',
})
export class CollaboratorsDialogComponent {
  private readonly dialogRef = inject(DialogRef<void>);
  protected readonly data = inject<CollaboratorsDialogData>(DIALOG_DATA);

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

  protected removeTooltip(uid: string): string {
    if (uid === this.data.currentUserId()) {
      return 'Vous ne pouvez pas vous retirer vous-même, supprimez le voyage à la place';
    }
    if (!this.data.isOwner()) {
      return 'Seul le créateur du voyage peut retirer un membre';
    }
    return '';
  }

  protected submitInvite(): void {
    if (!this.inviteeEmail) return;
    this.data.onAdd(this.inviteeEmail);
    this.inviteeEmail = '';
  }

  protected onAddCompanion(companion: Companion): void {
    this.data.onAdd(companion.email);
  }

  protected onRemove(uid: string): void {
    if (!this.canRemove(uid)) return;
    this.data.onRemove(uid);
  }

  protected onRemoveCompanionClick(event: Event, uid: string): void {
    event.stopPropagation();
    this.data.onRemoveCompanion(uid);
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
