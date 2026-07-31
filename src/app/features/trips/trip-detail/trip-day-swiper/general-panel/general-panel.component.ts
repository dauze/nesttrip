import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, effect, inject, input, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SelectButtonComponent, SelectButtonOption } from '@app/shared/components/select-button/select-button.component';
import { TripCreationTargetService } from '@app/features/trips/trip-detail/trip-creation-target.service';
import { LogisticFocusService } from '@app/features/trips/trip-detail/logistic-focus.service';
import { NotesFocusService } from '@app/features/trips/trip-detail/notes-focus.service';
import { TripChromeService } from '@app/core/services/trip-chrome.service';
import { NotesComponent } from './notes/notes.component';
import { TripActivitiesComponent } from './trip-activities/trip-activities.component';
import { LogisticsListComponent } from './logistics/logistics-list.component';
import { Notes } from './notes/notes.model';

type GeneralSubTab = 'notes' | 'activities' | 'logistics';
const SUB_TABS: GeneralSubTab[] = ['notes', 'activities', 'logistics'];

@Component({
  selector: 'app-general-panel',
  standalone: true,
  imports: [NotesComponent, TripActivitiesComponent, LogisticsListComponent, SelectButtonComponent],
  templateUrl: './general-panel.component.html',
  styleUrl: './general-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GeneralPanelComponent {
  private readonly fabTarget = inject(TripCreationTargetService);
  private readonly logisticFocusService = inject(LogisticFocusService);
  private readonly notesFocusService = inject(NotesFocusService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly chromeService = inject(TripChromeService);

  readonly notes = input.required<Notes>();
  readonly tripId = input.required<string>();
  /** Slide "Général" actuellement active dans le swiper — voir `TripActivitiesComponent.active`, qui décide si CE contexte possède la carte partagée (voir ROADMAP.md "Carte"). */
  readonly active = input(false);

  private readonly subTabSwitchRef = viewChild<ElementRef<HTMLElement>>('subTabSwitch');

  // Restaure le sous-onglet depuis l'URL (?tab=...) au premier rendu — voir
  // syncSubTabToUrl, qui l'y écrit à chaque changement, pour actualiser la
  // page sans perdre la position (voir ROADMAP.md).
  readonly activeSubTab = signal<GeneralSubTab>(this.readSubTabFromUrl() ?? 'activities');

  readonly subTabOptions: SelectButtonOption<GeneralSubTab>[] = [
    { label: 'Activités', value: 'activities', icon: 'pi pi-map-marker' },
    { label: 'Logistique', value: 'logistics', icon: 'pi pi-bookmark' },
    { label: 'Notes', value: 'notes', icon: 'pi pi-clipboard' }
  ];

  private readonly activitiesRef = viewChild(TripActivitiesComponent);

  constructor() {
    // Singleton (un seul onglet "Général") : enregistré une fois pour toute
    // la durée de vie du composant — voir TripCreationTargetService, lu par
    // le menu "Ajouter" unique porté par TripDetailComponent (entrée
    // "Activité", voir ROADMAP.md "UX / Interactions" — le "+" ouvre
    // désormais toujours ce menu, plus de création directe contextuelle ici).
    const unregister = this.fabTarget.registerGeneral({
      activeSubTab: this.activeSubTab,
      subTabOptions: this.subTabOptions,
      selectSubTab: (tab) => this.selectSubTab(tab),
      createActivity: () => this.activitiesRef()?.triggerCreate(),
    });
    this.destroyRef.onDestroy(unregister);

    // `.sub-tab-switch` est toujours présent dans le DOM (pas de `@if`,
    // contrairement à `GeneralSubTabBarComponent`) : un `ResizeObserver` posé
    // une seule fois au premier rendu suffit, pas besoin du pattern
    // effect()+onCleanup utilisé là-bas pour un élément qui va et vient.
    afterNextRender(() => {
      const el = this.subTabSwitchRef()?.nativeElement;
      if (!el) return;
      const observer = new ResizeObserver(() =>
        this.chromeService.registerHeight('generalSubTabSwitch', el.getBoundingClientRect().height),
      );
      observer.observe(el);
      this.destroyRef.onDestroy(() => {
        observer.disconnect();
        this.chromeService.registerHeight('generalSubTabSwitch', 0);
      });
    });

    // Demande de navigation croisée (voir LogisticFocusService) : bascule
    // le sous-onglet dès qu'une bannière de réservation demande le focus,
    // que ce sous-onglet soit déjà monté ou non (LogisticsListComponent
    // consomme ensuite la requête une fois monté).
    effect(() => {
      if (this.logisticFocusService.pending()) {
        this.activeSubTab.set('logistics');
        this.syncSubTabToUrl('logistics');
      }
    });

    // Demande de navigation croisée symétrique (voir NotesFocusService,
    // entrée "Note" du menu "Ajouter") : bascule sur le sous-onglet Notes,
    // que ce sous-onglet soit déjà monté ou non (NotesComponent consomme
    // ensuite la requête une fois monté, voir son constructeur).
    effect(() => {
      if (this.notesFocusService.pending()) {
        this.activeSubTab.set('notes');
        this.syncSubTabToUrl('notes');
      }
    });
  }

  selectSubTab(tab: GeneralSubTab | undefined): void {
    if (tab) {
      this.activeSubTab.set(tab);
      this.syncSubTabToUrl(tab);
    }
  }

  private readSubTabFromUrl(): GeneralSubTab | null {
    const value = this.route.snapshot.queryParamMap.get('tab');
    return SUB_TABS.includes(value as GeneralSubTab) ? (value as GeneralSubTab) : null;
  }

  /** `replaceUrl` : un changement de sous-onglet ne doit pas polluer l'historique de navigation (bouton "retour"). */
  private syncSubTabToUrl(tab: GeneralSubTab): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
