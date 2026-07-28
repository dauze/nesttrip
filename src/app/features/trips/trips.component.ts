import { Component, computed, ElementRef, inject, viewChild, afterNextRender, DestroyRef } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { ButtonComponent } from '@app/shared/components/button/button.component';
import { ToolbarComponent } from '@app/shared/components/toolbar/toolbar.component';
import { AppMenuItem, MenuComponent } from '@app/shared/components/menu/menu.component';
import { AuthService } from '@core/services/auth.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
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
import { ThemeService } from '@app/core/services/theme.service';
import { SaveStatusBarComponent } from '@app/shared/components/save-status-bar/save-status-bar.component';

@Component({
  selector: 'app-trips',
  standalone: true,
  imports: [RouterOutlet, ToolbarComponent, ButtonComponent, MenuComponent, SaveStatusBarComponent],
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
  ],
  templateUrl: 'trips.component.html',
  styleUrl: 'trips.component.scss',
})
export class TripsComponent {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  protected readonly chromeService = inject(TripChromeService);
  private readonly themeService = inject(ThemeService);
  private readonly destroyRef = inject(DestroyRef);

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

  readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => (e as NavigationEnd).urlAfterRedirects),
      startWith(this.router.url),
    ),
  );

  readonly showBack = computed(() => {
    const url = this.currentUrl() ?? '';
    return /^\/trips\/.+/.test(url);
  });

  readonly menuItems = computed<AppMenuItem[]>(() => {
    const mode = this.themeService.mode();
    return [
      {
        label: 'Thème',
        items: [
          {
            label: 'Clair',
            icon: 'pi pi-sun',
            active: mode === 'light',
            command: () => this.themeService.setMode('light'),
          },
          {
            label: 'Sombre',
            icon: 'pi pi-moon',
            active: mode === 'dark',
            command: () => this.themeService.setMode('dark'),
          },
          {
            label: 'Système',
            icon: 'pi pi-desktop',
            active: mode === 'system',
            command: () => this.themeService.setMode('system'),
          },
        ],
      },
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
  });

  goBack(): void {
    this.router.navigate(['/trips']);
  }
}