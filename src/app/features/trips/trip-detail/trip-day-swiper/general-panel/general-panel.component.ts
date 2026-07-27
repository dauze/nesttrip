import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal, viewChild } from '@angular/core';
import { SelectButtonComponent, SelectButtonOption } from '@app/shared/components/select-button/select-button.component';
import { TripCreationTargetService } from '@app/features/trips/trip-detail/trip-creation-target.service';
import { ReservationFocusService } from '@app/features/trips/trip-detail/reservation-focus.service';
import { NotesComponent } from './notes/notes.component';
import { TripActivitiesComponent } from './trip-activities/trip-activities.component';
import { ReservationsListComponent } from './reservations/reservations-list.component';
import { Notes } from './notes/notes.model';

type GeneralSubTab = 'notes' | 'activities' | 'reservations';

@Component({
  selector: 'app-general-panel',
  standalone: true,
  imports: [NotesComponent, TripActivitiesComponent, ReservationsListComponent, SelectButtonComponent],
  templateUrl: './general-panel.component.html',
  styleUrl: './general-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GeneralPanelComponent {
  private readonly fabTarget = inject(TripCreationTargetService);
  private readonly reservationFocusService = inject(ReservationFocusService);
  private readonly destroyRef = inject(DestroyRef);

  readonly notes = input.required<Notes>();
  readonly tripId = input.required<string>();

  readonly activeSubTab = signal<GeneralSubTab>('activities');

  readonly subTabOptions: SelectButtonOption<GeneralSubTab>[] = [
    { label: 'Activités', value: 'activities', icon: 'pi pi-map-marker' },
    { label: 'Réservations', value: 'reservations', icon: 'pi pi-bookmark' },
    { label: 'Notes', value: 'notes', icon: 'pi pi-clipboard' }
  ];

  private readonly activitiesRef = viewChild(TripActivitiesComponent);
  private readonly notesRef = viewChild(NotesComponent);
  private readonly reservationsRef = viewChild(ReservationsListComponent);

  constructor() {
    // Singleton (un seul onglet "Général") : enregistré une fois pour toute
    // la durée de vie du composant — voir TripCreationTargetService, lu par
    // le "+" flottant unique porté par TripDetailComponent.
    const unregister = this.fabTarget.registerGeneral({
      activeSubTab: this.activeSubTab,
      trigger: () => this.onFabActivate(),
    });
    this.destroyRef.onDestroy(unregister);

    // Demande de navigation croisée (voir ReservationFocusService) : bascule
    // le sous-onglet dès qu'une bannière de réservation demande le focus,
    // que ce sous-onglet soit déjà monté ou non (ReservationsListComponent
    // consomme ensuite la requête une fois monté).
    effect(() => {
      if (this.reservationFocusService.pending()) {
        this.activeSubTab.set('reservations');
      }
    });
  }

  selectSubTab(tab: GeneralSubTab | undefined): void {
    if (tab) {
      this.activeSubTab.set(tab);
    }
  }

  /** Point d'entrée unique du "+" flottant : redirige vers la création d'activité, de réservation ou de note selon le sous-onglet actif. */
  private onFabActivate(): void {
    switch (this.activeSubTab()) {
      case 'notes':
        this.notesRef()?.addItem();
        break;
      case 'reservations':
        this.reservationsRef()?.triggerCreate();
        break;
      default:
        this.activitiesRef()?.triggerCreate();
    }
  }
}
