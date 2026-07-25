import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, signal, viewChild } from '@angular/core';
import { SelectButtonComponent, SelectButtonOption } from '@app/shared/components/select-button/select-button.component';
import { TripCreationTargetService } from '@app/features/trips/trip-detail/trip-creation-target.service';
import { NotesComponent } from './notes/notes.component';
import { TripActivitiesComponent } from './trip-activities/trip-activities.component';
import { Notes } from './notes/notes.model';

type GeneralSubTab = 'notes' | 'activities';

@Component({
  selector: 'app-general-panel',
  standalone: true,
  imports: [NotesComponent, TripActivitiesComponent, SelectButtonComponent],
  templateUrl: './general-panel.component.html',
  styleUrl: './general-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GeneralPanelComponent {
  private readonly fabTarget = inject(TripCreationTargetService);
  private readonly destroyRef = inject(DestroyRef);

  readonly notes = input.required<Notes>();
  readonly tripId = input.required<string>();

  readonly activeSubTab = signal<GeneralSubTab>('activities');

  readonly subTabOptions: SelectButtonOption<GeneralSubTab>[] = [
    { label: 'Activités', value: 'activities', icon: 'pi pi-map-marker' },
    { label: 'Notes', value: 'notes', icon: 'pi pi-clipboard' }
  ];

  private readonly activitiesRef = viewChild(TripActivitiesComponent);
  private readonly notesRef = viewChild(NotesComponent);

  constructor() {
    // Singleton (un seul onglet "Général") : enregistré une fois pour toute
    // la durée de vie du composant — voir TripCreationTargetService, lu par
    // le "+" flottant unique porté par TripDetailComponent.
    const unregister = this.fabTarget.registerGeneral({
      activeSubTab: this.activeSubTab,
      trigger: () => this.onFabActivate(),
    });
    this.destroyRef.onDestroy(unregister);
  }

  selectSubTab(tab: GeneralSubTab | undefined): void {
    if (tab) {
      this.activeSubTab.set(tab);
    }
  }

  /** Point d'entrée unique du "+" flottant : redirige vers la création d'activité ou de note selon le sous-onglet actif. */
  private onFabActivate(): void {
    if (this.activeSubTab() === 'notes') {
      this.notesRef()?.addItem();
    } else {
      this.activitiesRef()?.triggerCreate();
    }
  }
}
