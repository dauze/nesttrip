import { Component, computed, inject } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ToolbarModule } from 'primeng/toolbar';
import { MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { AuthService } from '@core/services/auth.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';

@Component({
  selector: 'app-trips',
  standalone: true,
  imports: [RouterOutlet, ToolbarModule, ButtonModule, MenuModule],
  templateUrl: 'trips.component.html',
  styleUrl: 'trips.component.scss',
})
export class TripsComponent {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  // Affiche la flèche retour quand on est sur /trips/:id
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => (e as NavigationEnd).urlAfterRedirects),
      startWith(this.router.url),
    ),
  );

  readonly showBack = computed(() => {
    const url = this.currentUrl() ?? '';
    // /trips seul → pas de flèche, /trips/quelque-chose → flèche
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