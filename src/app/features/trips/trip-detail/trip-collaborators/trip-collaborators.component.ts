import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AvatarModule } from 'primeng/avatar';
import { AvatarGroupModule } from 'primeng/avatargroup';
import { TooltipModule } from 'primeng/tooltip';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { MessageModule } from 'primeng/message';
import { finalize } from 'rxjs';
import { CollaborationService } from '@app/core/services/collaboration.service';
import { TripMember } from '../../trip.model';

@Component({
  selector: 'app-trip-collaborators',
  standalone: true,
  imports: [
    FormsModule,
    AvatarModule,
    AvatarGroupModule,
    TooltipModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    SelectModule,
    MessageModule,
  ],
  templateUrl: './trip-collaborators.component.html',
  styleUrl: './trip-collaborators.component.scss',
})
export class TripCollaboratorsComponent {
  private readonly collaborationService = inject(CollaborationService);
  private readonly MAX_VISIBLE = 5;

  readonly tripId = input.required<string>();
  readonly members = input<Record<string, TripMember>>({});

  protected showInviteDialog = false;
  protected inviteeEmail = '';
  readonly inviteLoading = signal(false);
  readonly inviteError = signal<string | null>(null);

  readonly visibleMembers = computed(() =>
    Object.entries(this.members()).slice(0, this.MAX_VISIBLE)
  );
  readonly extraCount = computed(() =>
    Math.max(0, Object.keys(this.members()).length - this.MAX_VISIBLE)
  );
  readonly extraTooltip = computed(() =>
    Object.keys(this.members()).slice(this.MAX_VISIBLE).join(', ')
  );

  getInitials(member: TripMember): string {
    if (member.displayName) {
      return member.displayName
        .split(' ')
        .map(n => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
    }
    return member.email.slice(0, 2).toUpperCase();
  }

  protected openInviteDialog(): void {
    this.inviteeEmail = '';
    this.inviteError.set(null);
    this.showInviteDialog = true;
  }

  protected closeInviteDialog(): void {
    this.showInviteDialog = false;
  }

  protected inviteCollaborator(): void {
    if (!this.inviteeEmail) return;

    this.inviteLoading.set(true);
    this.inviteError.set(null);

    this.collaborationService
      .addCollaborator(this.tripId(), this.inviteeEmail)
      .pipe(finalize(() => this.inviteLoading.set(false)))
      .subscribe({
        next: () => {
          this.closeInviteDialog();
          this.inviteeEmail = '';
        },
        error: (err) => {
          const message = err?.error?.error ?? err?.message ?? 'Une erreur est survenue';
          this.inviteError.set(message);
        },
      });
  }
}