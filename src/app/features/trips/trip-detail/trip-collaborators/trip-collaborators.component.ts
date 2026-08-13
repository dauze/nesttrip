import { ChangeDetectionStrategy, Component, ViewContainerRef, computed, inject, input, signal } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
import { finalize } from 'rxjs';
import { AvatarComponent } from '@app/shared/components/avatar/avatar.component';
import { AvatarGroupComponent } from '@app/shared/components/avatar-group/avatar-group.component';
import { TooltipDirective } from '@app/shared/directives/tooltip.directive';
import { DialogService } from '@app/shared/services/dialog.service';
import { AuthService } from '@app/core/services/auth.service';
import { UserProfileService } from '@app/core/services/user-profile.service';
import {
  CollaboratorsDialogComponent,
  CollaboratorsDialogData,
} from '@app/shared/components/collaborators-dialog/collaborators-dialog.component';
import { TripFacade } from '../../trip-facade.service';
import { getInitials } from '@app/shared/utils/get-initials';

/**
 * Avatars des participants — cliquable (voir `openDialog`), ouvre directement
 * la pop-up "compagnons de route" (`CollaboratorsDialogComponent`, même
 * dialog que la ligne "Participants" de `TripSettingsSectionComponent`).
 * Monté dans la toolbar app (`TripsComponent`, à côté de la roue crantée) au
 * lieu du header voyage (ROADMAP.md, "Le trip header doit évoluer") : le
 * header n'affiche plus que les NOMS des compagnons (texte), pas les avatars.
 */
@Component({
  selector: 'app-trip-collaborators',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, AvatarGroupComponent, TooltipDirective],
  templateUrl: './trip-collaborators.component.html',
  styleUrl: './trip-collaborators.component.scss',
})
export class TripCollaboratorsComponent {
  private readonly tripFacade = inject(TripFacade);
  private readonly dialogService = inject(DialogService);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly authService = inject(AuthService);
  private readonly userProfileService = inject(UserProfileService);
  private readonly MAX_VISIBLE = 5;

  readonly tripId = input.required<string>();
  readonly members = computed(() => this.tripFacade.getTripMembers(this.tripId())());

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

  private readonly currentUserId = computed(() => this.authService.getCurrentUser()?.uid ?? '');
  private readonly isOwner = computed(() => this.members()[this.currentUserId()]?.role === 'owner');

  private readonly addLoading = signal(false);
  private readonly addError = signal<string | null>(null);
  private collaboratorsDialogRef?: DialogRef<void, CollaboratorsDialogComponent>;

  protected openDialog(): void {
    this.addError.set(null);
    const data: CollaboratorsDialogData = {
      members: this.members,
      currentUserId: this.currentUserId,
      isOwner: this.isOwner,
      companions: this.userProfileService.companions,
      addLoading: this.addLoading,
      addError: this.addError,
      onAdd: (email) => this.onAddCollaborator(email),
      onRemove: (uid) => this.onRemoveCollaborator(uid),
      onRemoveCompanion: (uid) => this.onRemoveCompanion(uid),
    };
    this.collaboratorsDialogRef = this.dialogService.open<void, CollaboratorsDialogData, CollaboratorsDialogComponent>(
      CollaboratorsDialogComponent,
      { data, viewContainerRef: this.viewContainerRef },
    );
  }

  private onAddCollaborator(email: string): void {
    this.addLoading.set(true);
    this.addError.set(null);

    this.tripFacade
      .addCollaborator(this.tripId(), email)
      .pipe(finalize(() => this.addLoading.set(false)))
      .subscribe({
        next: () => this.collaboratorsDialogRef?.close(),
        error: (err) => {
          const message = err?.error?.error ?? err?.message ?? 'Une erreur est survenue';
          this.addError.set(message);
        },
      });
  }

  private onRemoveCollaborator(memberUid: string): void {
    this.tripFacade.removeCollaborator(this.tripId(), memberUid).subscribe({
      error: (err) => console.error('[TripCollaborators] Erreur suppression collaborateur', err),
    });
  }

  private onRemoveCompanion(companionUid: string): void {
    this.userProfileService.removeCompanion(companionUid).subscribe({
      error: (err) => console.error('[TripCollaborators] Erreur suppression companion', err),
    });
  }
}
