import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, viewChild, afterNextRender, DestroyRef } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { Location } from '@angular/common';
import { ButtonComponent } from '@app/shared/components/button/button.component';
import { ToolbarComponent } from '@app/shared/components/toolbar/toolbar.component';
import { AppMenuItem, MenuComponent } from '@app/shared/components/menu/menu.component';
import { AuthService } from '@core/services/auth.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable, filter, map, merge, startWith } from 'rxjs';
import { FirebaseTripRepository } from '@app/core/infra/firebase/services/firebase-trip-repository';
import { TripRepository } from '@app/core/infra/firebase/services/trip-repository';
import { TripFacade } from './trip-facade.service';
import { TripChromeService } from '@app/core/services/trip-chrome.service';
import { TripDataSource } from '@app/core/infra/firebase/services/trip-data-source';
import { FileService } from '@app/core/services/file.service';
import { ActivityDispatchService } from '@app/core/services/activity-dispatch.service';
import { GoogleMapPanelService } from '@app/core/services/google-map-panel.service';
import { GooglePhotoService } from '@app/core/services/google-photo.service';
import { GooglePlaceService } from '@app/core/services/google-place.service';
import { PhotoViewerService } from '@app/core/services/photo-viewer.service';
import { UserProfileService } from '@app/core/services/user-profile.service';
import { ThemeMode, ThemeService } from '@app/core/services/theme.service';
import { FlightStatusRefreshService } from '@app/core/services/flight-status-refresh.service';
import { SaveStatusBarComponent } from '@app/shared/components/save-status-bar/save-status-bar.component';
import { SelectButtonComponent, SelectButtonOption } from '@app/shared/components/select-button/select-button.component';

@Component({
  selector: 'app-trips',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, ToolbarComponent, ButtonComponent, MenuComponent, SaveStatusBarComponent, SelectButtonComponent],
  // Services scopés à /trips (pas root) : leur état/leurs écritures n'ont de
  // sens que dans ce sous-arbre de routes (rien en dehors, ex. /login, n'y
  // touche jamais) — voir la revue de portée des services dans CLAUDE.md.
  // Ne pas y ajouter les services de persistence Firebase (Activity/Day/
  // DayActivityInstance/Notes/Trip/DayPersistence) : ils restent root car
  // TripStore, lui-même root par design (pool d'activités partagé entre
  // plusieurs trips), les injecte directement.
  providers: [
    FirebaseTripRepository,
    TripFacade,
    { provide: TripRepository, useExisting: FirebaseTripRepository },
    TripDataSource,
    FileService,
    ActivityDispatchService,
    TripChromeService,
    GoogleMapPanelService,
    GooglePhotoService,
    GooglePlaceService,
    PhotoViewerService,
    UserProfileService,
    FlightStatusRefreshService,
  ],
  templateUrl: 'trips.component.html',
  styleUrl: 'trips.component.scss',
})
export class TripsComponent {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly authService = inject(AuthService);
  private readonly tripFacade = inject(TripFacade);
  protected readonly chromeService = inject(TripChromeService);
  protected readonly themeService = inject(ThemeService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly themeOptions: SelectButtonOption<ThemeMode>[] = [
    { label: '', value: 'light', icon: 'pi pi-sun' },
    { label: '', value: 'dark', icon: 'pi pi-moon' },
    { label: '', value: 'system', icon: 'pi pi-desktop' },
  ];

  private readonly toolbarRef = viewChild<ElementRef<HTMLElement>>('toolbarRef');

  constructor() {
    afterNextRender(() => {
      const el = this.toolbarRef()?.nativeElement;
      if (!el) return;

      // getBoundingClientRect (pas entry.contentRect, qui exclut le padding/bordure)
      // pour mesurer le vrai encombrement visuel de l'élément observé.
      const observer = new ResizeObserver(() => {
        this.chromeService.registerHeight('toolbar', el.getBoundingClientRect().height);
      });
      observer.observe(el);

      // Écriture DOM directe du transform (voir TripChromeService) : pas de
      // binding [style.transform] dans le template, pour ne pas ajouter le
      // cycle de détection de changement d'Angular entre le scroll natif et
      // l'application visuelle du translateY.
      const unregister = this.chromeService.registerChromeElement(el);

      this.destroyRef.onDestroy(() => {
        observer.disconnect();
        unregister();
      });
    });
  }

  /**
   * Fusionne les `NavigationEnd` du Router ET les changements bruts de
   * `Location` (voir `TripDetailComponent.updateFragment`/`bindPopState`,
   * ROADMAP.md "UX / Interactions") : la navigation par tab/jour à l'intérieur
   * d'un trip passe par `Location.go`/le bouton "retour" navigateur, jamais
   * par le Router — sans cette 2e source, `currentUrl` restait figé sur la
   * toute première URL Router (sans fragment) et ne recevait plus aucune
   * mise à jour après un retour navigateur, cassant `toolbarTitle` (retombe
   * sur "NestTrip" alors qu'on est toujours sur le même trip).
   */
  readonly currentUrl = toSignal(
    merge(
      this.router.events.pipe(
        filter((e) => e instanceof NavigationEnd),
        map((e) => (e as NavigationEnd).urlAfterRedirects),
      ),
      new Observable<string>((observer) => {
        const subscription = this.location.subscribe(() => observer.next(this.location.path(true)));
        return () => subscription.unsubscribe();
      }),
    ).pipe(startWith(this.router.url)),
  );

  readonly showBack = computed(() => {
    const url = this.currentUrl() ?? '';
    return /^\/trips\/.+/.test(url);
  });

  /**
   * Remplace "NestTrip" par le nom du voyage sur l'écran de détail (voir
   * ROADMAP.md "UX / Interactions") — garde-fou de longueur simple (CSS
   * ellipsis, voir styleUrl) plutôt qu'une troncature JS, le titre complet
   * reste dispo au survol via l'attribut `title`.
   *
   * Id de trip extrait de l'URL (pas de `activeTrip()?.id`) : `getTripTitle`
   * est un signal dédié, indépendant de `activeTrip()` (voir
   * TripStore._tripTitle) — passer par `activeTrip()` ne serait-ce que pour
   * son `id` réintroduirait une dépendance à CE signal, donc un recalcul de
   * `toolbarTitle` à chaque mutation du trip actif (pas seulement son titre).
   * `[^/?#]+` (pas juste `[^/?]+`) : `currentUrl` peut désormais porter un
   * fragment (`/trips/abc#day-1`, voir sa doc) — sans exclure `#`, l'id
   * capturé embarquait le fragment entier, cassant `getTripTitle(id)`.
   */
  readonly toolbarTitle = computed(() => {
    if (!this.showBack()) return 'NestTrip';
    const id = (this.currentUrl() ?? '').match(/^\/trips\/([^/?#]+)/)?.[1];
    return (id ? this.tripFacade.getTripTitle(id)() : '') || 'NestTrip';
  });

  readonly menuItems: AppMenuItem[] = [
    {
      label: 'Compte',
      items: [
        {
          label: 'Se déconnecter',
          icon: 'pi pi-sign-out',
          command: () => this.authService.logout().subscribe(),
        },
      ],
    },
  ];

  goBack(): void {
    this.router.navigate(['/trips']);
  }

  protected onThemeChange(mode: ThemeMode | undefined): void {
    if (mode) this.themeService.setMode(mode);
  }
}