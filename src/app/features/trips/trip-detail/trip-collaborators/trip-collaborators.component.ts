import { Component, computed, inject, input, signal } from '@angular/core';
import { AvatarComponent } from '@app/shared/components/avatar/avatar.component';
import { AvatarGroupComponent } from '@app/shared/components/avatar-group/avatar-group.component';
import { TooltipDirective } from '@app/shared/directives/tooltip.directive';
import { finalize } from 'rxjs';
import { TripFacade } from '../../trip-facade.service';
import { AuthService } from '@app/core/services/auth.service';
import { UserProfileService } from '@app/core/services/user-profile.service';
import { CollaboratorsDialogComponent } from '@app/shared/components/collaborators-dialog/collaborators-dialog.component';
import { getInitials } from '@app/shared/utils/get-initials';

@Component({
  selector: 'app-trip-collaborators',
  standalone: true,
  imports: [AvatarComponent, AvatarGroupComponent, TooltipDirective, CollaboratorsDialogComponent],
  templateUrl: './trip-collaborators.component.html',
  styleUrl: './trip-collaborators.component.scss',
})
export class TripCollaboratorsComponent {
  private readonly tripFacade = inject(TripFacade);
  private readonly authService = inject(AuthService);
  protected readonly userProfileService = inject(UserProfileService);
  private readonly MAX_VISIBLE = 5;

  readonly tripId = input.required<string>();
  readonly members = computed(() => this.tripFacade.getTripMembers(this.tripId())());

  protected readonly currentUserId = computed(() => this.authService.getCurrentUser()?.uid ?? '');
  protected readonly isOwner = computed(() => this.members()[this.currentUserId()]?.role === 'owner');

  protected showDialog = false;
  readonly addLoading = signal(false);
  readonly addError = signal<string | null>(null);

  readonly visibleMembers = computed(() =>
    Object.entries(this.members()).slice(0, this.MAX_VISIBLE)
  );
  readonly extraCount = computed(() =>
    Math.max(0, Object.keys(this.members()).length - this.MAX_VISIBLE)
  );
  readonly extraTooltip = computed(() =>
    Object.values(this.members())
      .slice(this.MAX_VISIBLE)
      .map((m) => m.displayName || m.email)
      .join(', ')
  );

  protected readonly getInitials = getInitials;

  protected openDialog(): void {
    this.addError.set(null);
    this.showDialog = true;
  }

  protected onAdd(email: string): void {
    this.addLoading.set(true);
    this.addError.set(null);

    this.tripFacade
      .addCollaborator(this.tripId(), email)
      .pipe(finalize(() => this.addLoading.set(false)))
      .subscribe({
        next: () => {
          this.showDialog = false;
        },
        error: (err) => {
          const message = err?.error?.error ?? err?.message ?? 'Une erreur est survenue';
          this.addError.set(message);
        },
      });
  }

  protected onRemove(memberUid: string): void {
    this.tripFacade.removeCollaborator(this.tripId(), memberUid).subscribe({
      error: (err) => console.error('[TripCollaborators] Erreur suppression collaborateur', err),
    });
  }

  protected onRemoveCompanion(companionUid: string): void {
    this.userProfileService.removeCompanion(companionUid).subscribe({
      error: (err) => console.error('[TripCollaborators] Erreur suppression companion', err),
    });
  }
}
