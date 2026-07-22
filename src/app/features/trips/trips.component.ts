import { Component, computed, ElementRef, inject, viewChild, afterNextRender, DestroyRef } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ToolbarModule } from 'primeng/toolbar';
import { MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { AuthService } from '@core/services/auth.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { FirebaseTripRepository } from '@app/core/infra/firebase/services/firebase-trip-repository';
import { TripRepository } from '@app/core/infra/firebase/services/trip-repository';
import { TripFacade } from './trip-facade.service';
import { TripChromeService } from '@app/core/services/trip-chrome.service';

@Component({
  selector: 'app-trips',
  standalone: true,
  imports: [RouterOutlet, ToolbarModule, ButtonModule, MenuModule],
  providers: [
    FirebaseTripRepository,
      TripFacade,
    { provide: TripRepository, useExisting: FirebaseTripRepository }
  ],
  templateUrl: 'trips.component.html',
  styleUrl: 'trips.component.scss',
})
export class TripsComponent {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  protected readonly chromeService = inject(TripChromeService);
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
      this.destroyRef.onDestroy(() => observer.disconnect());
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

  readonly menuItems: MenuItem[] = [
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
}