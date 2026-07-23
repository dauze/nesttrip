import { Component, computed, inject, input, signal } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
import { AvatarComponent } from '@app/shared/components/avatar/avatar.component';
import { AvatarGroupComponent } from '@app/shared/components/avatar-group/avatar-group.component';
import { TooltipDirective } from '@app/shared/directives/tooltip.directive';
import { finalize } from 'rxjs';
import { TripFacade } from '../../trip-facade.service';
import { AuthService } from '@app/core/services/auth.service';
import { UserProfileService } from '@app/core/services/user-profile.service';
import { CollaboratorsDialogComponent, CollaboratorsDialogData } from '@app/shared/components/collaborators-dialog/collaborators-dialog.component';
import { DialogService } from '@app/shared/services/dialog.service';
import { getInitials } from '@app/shared/utils/get-initials';

@Component({
  selector: 'app-trip-collaborators',
  standalone: true,
  imports: [AvatarComponent, AvatarGroupComponent, TooltipDirective],
  templateUrl: './trip-collaborators.component.html',
  styleUrl: './trip-collaborators.component.scss',
})
export class TripCollaboratorsComponent {
  private readonly tripFacade = inject(TripFacade);
  private readonly authService = inject(AuthService);
  protected readonly userProfileService = inject(UserProfileService);
  private readonly dialogService = inject(DialogService);
  private readonly MAX_VISIBLE = 5;

  readonly tripId = input.required<string>();
  readonly members = computed(() => this.tripFacade.getTripMembers(this.tripId())());

  protected readonly currentUserId = computed(() => this.authService.getCurrentUser()?.uid ?? '');
  protected readonly isOwner = computed(() => this.members()[this.currentUserId()]?.role === 'owner');

  private readonly addLoading = signal(false);
  private readonly addError = signal<string | null>(null);
  /** Réf. du dialog ouvert par `openDialog` — utilisée pour le refermer depuis `onAdd` en cas de succès. */
  private dialogRef?: DialogRef<void, CollaboratorsDialogComponent>;

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
    // Les signaux (pas leur valeur au moment de l'ouverture) passent tels
    // quels via DIALOG_DATA : le contenu du dialog (monté hors de l'arbre de
    // vue de ce composant, via DialogService/cdk-overlay) reste ainsi
    // réactif aux mises à jour temps réel des membres/companions, et à
    // addLoading/addError pendant l'ajout, sans passer par des `@Input()`.
    const data: CollaboratorsDialogData = {
      members: this.members,
      currentUserId: this.currentUserId,
      isOwner: this.isOwner,
      companions: this.userProfileService.companions,
      addLoading: this.addLoading,
      addError: this.addError,
      onAdd: (email) => this.onAdd(email),
      onRemove: (uid) => this.onRemove(uid),
      onRemoveCompanion: (uid) => this.onRemoveCompanion(uid),
    };
    this.dialogRef = this.dialogService.open<void, CollaboratorsDialogData, CollaboratorsDialogComponent>(CollaboratorsDialogComponent, { data });
  }

  private onAdd(email: string): void {
    this.addLoading.set(true);
    this.addError.set(null);

    this.tripFacade
      .addCollaborator(this.tripId(), email)
      .pipe(finalize(() => this.addLoading.set(false)))
      .subscribe({
        next: () => {
          this.dialogRef?.close();
        },
        error: (err) => {
          const message = err?.error?.error ?? err?.message ?? 'Une erreur est survenue';
          this.addError.set(message);
        },
      });
  }

  private onRemove(memberUid: string): void {
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
