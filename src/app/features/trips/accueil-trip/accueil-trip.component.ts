import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CardComponent } from '@app/shared/components/card/card.component';
import { ButtonComponent } from '@app/shared/components/button/button.component';
import { SkeletonComponent } from '@app/shared/components/skeleton/skeleton.component';
import { MessageComponent } from '@app/shared/components/message/message.component';
import { CheckboxComponent } from '@app/shared/components/checkbox/checkbox.component';
import { SelectableDirective } from '@app/shared/directives/selectable.directive';
import { LongPressDirective } from '@app/shared/directives/long-press.directive';
import { SelectionModeService } from '@app/shared/services/selection-mode.service';
import { SelectionActionBarComponent } from '@app/shared/components/selection-action-bar/selection-action-bar.component';
import { ConfirmDialogService } from '@app/shared/services/confirm-dialog.service';
import { TripFacade } from '../trip-facade.service';
import { TripSummary } from '../trip.model';
import { AuthService } from '@app/core/services/auth.service';
import { NgClass } from '@angular/common';
import { TooltipDirective } from '@app/shared/directives/tooltip.directive';
import { ViewportService } from '@app/core/services/viewport.service';
import { UserProfileService } from '@app/core/services/user-profile.service';

@Component({
  selector: 'app-accueil-trip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CardComponent,
    ButtonComponent,
    SkeletonComponent,
    MessageComponent,
    RouterModule,
    CheckboxComponent,
    NgClass,
    TooltipDirective,
    SelectableDirective,
    LongPressDirective,
    SelectionActionBarComponent,
  ],
  templateUrl: 'accueil-trip.component.html',
  styleUrl: 'accueil-trip.component.scss',
  // Une instance dédiée (voir SelectionModeService) : le mode sélection de
  // cet écran ne doit jamais se mélanger avec celui de trip-detail.
  providers: [SelectionModeService],
})
export class AccueilTripComponent {
  protected readonly tripFacade = inject(TripFacade);
  private readonly router = inject(Router);
  private readonly confirmDialogService = inject(ConfirmDialogService);
  private readonly authService = inject(AuthService);
  protected readonly selectionService = inject(SelectionModeService);
  protected readonly viewport = inject(ViewportService);
  protected readonly userProfileService = inject(UserProfileService);

  readonly trips = this.tripFacade.trips;
  readonly tripsLoading = this.tripFacade.tripsLoading;
  readonly user = this.authService.getCurrentUser();

  /** Prénom seul (1er mot de `displayName`, voir AuthService) pour le message de bienvenue étape 1 (src/specs/Parcours-new-user.md). */
  protected readonly firstName = computed(() => this.user?.displayName?.split(' ')[0] ?? '');

  constructor() {
    // Redirection directe, UNIQUEMENT à l'ouverture de la web app (juste
    // après un login, voir AuthService.justLoggedIn) — jamais lors d'un
    // retour manuel depuis un trip, sinon impossible de revenir sur cet écran
    // (voir ROADMAP.md, tentative précédente désactivée pour cette raison).
    // Consommé une seule fois, dès que le chargement des trips ET du profil
    // (voir `UserProfileService.profileLoaded`, nécessaire pour trancher
    // `hasSeenOnboarding` ci-dessous) aboutit :
    // - aucun trip, `hasSeenOnboarding` déjà vrai -> écran "Nouveau voyage"
    //   directement (rien à afficher ici) ;
    // - aucun trip, `hasSeenOnboarding` faux (nouvel utilisateur) -> reste sur
    //   cet écran, qui affiche alors l'accueil chaleureux étape 1
    //   (src/specs/Parcours-new-user.md) — l'utilisateur clique lui-même sur
    //   "Créer nouvelle aventure" ;
    // - un trip ACTIF (voir `isActiveTrip`) -> ce trip directement, qu'il y en
    //   ait d'autres ou non (décision actée, voir ROADMAP.md "UX / Interactions") ;
    // - sinon (aucun trip actif, un ou plusieurs) -> reste sur cet écran.
    effect(() => {
      if (!this.authService.justLoggedIn() || this.tripsLoading() || !this.userProfileService.profileLoaded()) return;

      this.authService.justLoggedIn.set(false);
      const trips = this.trips();

      if (trips.length === 0) {
        if (this.userProfileService.hasSeenOnboarding()) this.router.navigate(['/trips/new']);
        return;
      }

      const active = trips.find((t) => this.isActiveTrip(t));
      if (active) this.router.navigate(['/trips', active.id]);
    });
  }

  /** Un trip est "actif" si la date du jour tombe dans l'intervalle (inclusif) `earliestDay`-`latestDay` — voir ROADMAP.md "UX / Interactions" et `TripSummary`. Comparaison en date seule (minuit local), l'heure n'a pas de sens ici. */
  private isActiveTrip(trip: TripSummary): boolean {
    if (!trip.earliestDay || !trip.latestDay) return false;
    const dateOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const today = dateOnly(new Date());
    return today >= dateOnly(trip.earliestDay) && today <= dateOnly(trip.latestDay);
  }

  selectTrip(id: string): void {
    this.router.navigate(['/trips', id]);
  }

  onSelectionCancel(): void {
    this.selectionService.cancel();
  }

  onSelectionDelete(): void {
    const ids = this.selectionService.values().map((ref) => ref.id);
    if (ids.length === 0) return;

    const plural = ids.length > 1 ? 's' : '';
    this.confirmDialogService.confirm({
      message: `Êtes-vous sûr de vouloir supprimer ${ids.length > 1 ? 'ces' : 'ce'} voyage${plural} ? Il${plural} ser${plural ? 'ont' : 'a'} perdu${plural} définitivement.`,
      header: 'Confirmation',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Oui',
      rejectLabel: 'Non',
      accept: () => {
        for (const id of ids) this.tripFacade.removeTrip(id);
        this.selectionService.cancel();
      },
    });
  }
}
