import { Component, computed, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AvatarComponent } from '@app/shared/components/avatar/avatar.component';
import { TooltipModule } from 'primeng/tooltip';
import { ButtonComponent } from '@app/shared/components/button/button.component';
import { DialogModule } from 'primeng/dialog';
import { InputTextDirective } from '@app/shared/directives/input-text.directive';
import { MessageComponent } from '@app/shared/components/message/message.component';
import { TripMember } from '@app/features/trips/trip.model';
import { Companion } from '@app/core/models/user-profile.dto';
import { getInitials } from '@app/shared/utils/get-initials';

@Component({
  selector: 'app-collaborators-dialog',
  standalone: true,
  imports: [FormsModule, AvatarComponent, TooltipModule, ButtonComponent, DialogModule, InputTextDirective, MessageComponent],
  templateUrl: './collaborators-dialog.component.html',
  styleUrl: './collaborators-dialog.component.scss',
})
export class CollaboratorsDialogComponent {
  readonly visible = model.required<boolean>();
  readonly members = input.required<Record<string, TripMember>>();
  readonly currentUserId = input.required<string>();
  readonly isOwner = input(false);
  readonly companions = input<Companion[]>([]);
  readonly addLoading = input(false);
  readonly addError = input<string | null>(null);

  readonly add = output<string>();
  readonly remove = output<string>();
  readonly removeCompanion = output<string>();

  protected inviteeEmail = '';

  protected readonly getInitials = getInitials;

  readonly memberEntries = computed(() => Object.entries(this.members()));

  readonly availableCompanions = computed(() => {
    const memberUids = new Set(Object.keys(this.members()));
    return this.companions().filter((c) => !memberUids.has(c.uid));
  });

  protected canRemove(uid: string): boolean {
    return this.isOwner() && uid !== this.currentUserId();
  }

  protected removeTooltip(uid: string): string {
    if (uid === this.currentUserId()) {
      return 'Vous ne pouvez pas vous retirer vous-même, supprimez le voyage à la place';
    }
    if (!this.isOwner()) {
      return 'Seul le créateur du voyage peut retirer un membre';
    }
    return '';
  }

  protected submitInvite(): void {
    if (!this.inviteeEmail) return;
    this.add.emit(this.inviteeEmail);
    this.inviteeEmail = '';
  }

  protected onAddCompanion(companion: Companion): void {
    this.add.emit(companion.email);
  }

  protected onRemove(uid: string): void {
    if (!this.canRemove(uid)) return;
    this.remove.emit(uid);
  }

  protected onRemoveCompanionClick(event: Event, uid: string): void {
    event.stopPropagation();
    this.removeCompanion.emit(uid);
  }

  protected close(): void {
    this.visible.set(false);
  }
}
