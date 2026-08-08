import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { AvatarComponent } from '@app/shared/components/avatar/avatar.component';
import { AvatarGroupComponent } from '@app/shared/components/avatar-group/avatar-group.component';
import { TooltipDirective } from '@app/shared/directives/tooltip.directive';
import { TripFacade } from '../../trip-facade.service';
import { getInitials } from '@app/shared/utils/get-initials';

/**
 * Affichage seul des avatars des participants (voir `TripHeaderComponent`,
 * projeté dans `[trip-actions]`) — plus interactif isolément depuis ce
 * déplacement (ROADMAP.md, "Le trip header doit évoluer") : le clic (sur
 * toute la ligne du header parent) ouvre désormais le menu réglages, dont la
 * ligne "Participants" (voir `TripSettingsSectionComponent`) reprend l'ancien
 * dialog d'édition des collaborateurs.
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
}
