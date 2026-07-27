import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { TagComponent, TagSeverity } from '@app/shared/components/tag/tag.component';
import { ButtonComponent } from '@app/shared/components/button/button.component';
import { FlightStatusRefreshService, getRefreshPhase, REFRESH_INTERVAL_MS } from '@core/services/flight-status-refresh.service';
import { FlightReservation } from '@core/models/reservation.dto';

const MANUAL_REFRESH_COOLDOWN_S = 60;

interface BadgeMeta {
  label: string;
  severity: TagSeverity;
}

function badgeMetaFor(flight: FlightReservation): BadgeMeta {
  const status = flight.status;
  if (!status) return { label: 'Pas encore de données', severity: 'secondary' };

  switch (status.state) {
    case 'cancelled': return { label: 'Annulé', severity: 'danger' };
    case 'delayed': return { label: status.delayMinutes ? `Retardé (+${status.delayMinutes} min)` : 'Retardé', severity: 'warn' };
    case 'landed': return { label: 'Arrivé', severity: 'success' };
    case 'onTime': return { label: 'À l\'heure', severity: 'success' };
    case 'scheduled': return { label: 'Prévu', severity: 'secondary' };
  }
}

/**
 * Badge de statut vol (voir Reservation.md Phase 4) — affiché à la fois sur
 * la bannière jour et dans le sous-menu Réservations. Le polling automatique
 * (voir `FlightStatusRefreshService.refreshIfStale`) ne tourne QUE tant que
 * ce composant est monté (donc visible) : `effect()` + `onCleanup` démarre/
 * arrête le `setInterval`, jamais de polling en arrière-plan indépendant du
 * cycle de vie du composant.
 */
@Component({
  selector: 'app-flight-status-badge',
  standalone: true,
  imports: [TagComponent, ButtonComponent],
  templateUrl: './flight-status-badge.component.html',
  styleUrl: './flight-status-badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlightStatusBadgeComponent {
  private readonly refreshService = inject(FlightStatusRefreshService);
  private readonly destroyRef = inject(DestroyRef);

  readonly tripId = input.required<string>();
  readonly reservation = input.required<FlightReservation>();

  readonly meta = computed(() => badgeMetaFor(this.reservation()));

  readonly cooldownRemaining = signal(0);
  readonly refreshing = signal(false);

  private cooldownIntervalId: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Un seul polling actif à la fois pour ce badge : re-démarre à chaque
    // changement de réservation/phase, s'arrête net au démontage (composant
    // plus visible) via `onCleanup`.
    effect((onCleanup) => {
      const tripId = this.tripId();
      const reservation = this.reservation();
      const phase = getRefreshPhase(reservation, new Date());
      const intervalMs = REFRESH_INTERVAL_MS[phase];

      this.refreshService.refreshIfStale(tripId, reservation);
      if (intervalMs === null) return;

      const id = setInterval(() => this.refreshService.refreshIfStale(tripId, reservation), intervalMs);
      onCleanup(() => clearInterval(id));
    });

    this.destroyRef.onDestroy(() => {
      if (this.cooldownIntervalId) clearInterval(this.cooldownIntervalId);
    });
  }

  /** `stopPropagation` : ce badge est souvent imbriqué dans une carte/ligne cliquable (navigation) — le clic sur le refresh ne doit jamais la déclencher. */
  onRefreshClick(event: MouseEvent): void {
    event.stopPropagation();
    this.manualRefresh();
  }

  private manualRefresh(): void {
    if (this.cooldownRemaining() > 0 || this.refreshing()) return;

    this.refreshing.set(true);
    this.refreshService.forceRefresh(this.tripId(), this.reservation()).subscribe({
      complete: () => this.refreshing.set(false),
      error: () => this.refreshing.set(false),
    });
    this.startCooldown();
  }

  private startCooldown(): void {
    this.cooldownRemaining.set(MANUAL_REFRESH_COOLDOWN_S);
    if (this.cooldownIntervalId) clearInterval(this.cooldownIntervalId);
    this.cooldownIntervalId = setInterval(() => {
      this.cooldownRemaining.update((s) => {
        if (s <= 1) {
          if (this.cooldownIntervalId) clearInterval(this.cooldownIntervalId);
          this.cooldownIntervalId = null;
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }
}
