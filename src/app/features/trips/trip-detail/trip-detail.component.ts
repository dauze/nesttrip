import { FormsModule } from '@angular/forms';
import { Component, computed, effect, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TabsModule } from 'primeng/tabs';
import { CardModule } from 'primeng/card';
import { ToolbarModule } from 'primeng/toolbar';
import { SkeletonModule } from 'primeng/skeleton';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { MessageModule } from 'primeng/message';
import { ConfirmationService } from 'primeng/api';
import { SwipeDirective } from '@app/shared/directives/swipe.directive';
import { Trip } from '../trip.model';
import { TripRole } from '../trip.model';
import { DayPanelComponent } from './day-panel/day-panel.component';
import { InfosComponent } from './infos/infos.component';
import { InfosSkeletonComponent } from './infos/infos-skeleton.component';
import { finalize } from 'rxjs';
import { TripFacade } from '../trip-facade.service';
import { CollaborationService } from '@app/core/services/collaboration.service';

@Component({
  selector: 'app-trip-detail',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    TabsModule,
    CardModule,
    ToolbarModule,
    SkeletonModule,
    ConfirmDialog,
    DialogModule,
    InputTextModule,
    SelectModule,
    MessageModule,
    InfosComponent,
    DayPanelComponent,
    SwipeDirective,
    InfosSkeletonComponent,
  ],
  providers: [ConfirmationService],
  templateUrl: 'trip-detail.component.html',
  styleUrl: 'trip-detail.component.scss',
})
export class TripDetailComponent implements OnInit, OnDestroy {
  protected readonly facade = inject(TripFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly collaborationService = inject(CollaborationService);

  // — dialog state
  protected showInviteDialog = false;
  protected inviteeEmail = '';
  protected inviteeRole: TripRole = 'editor';
  protected readonly inviteLoading = signal(false);
  protected readonly inviteError = signal<string | null>(null);

  protected readonly roleOptions: { label: string; value: TripRole }[] = [
    { label: 'Éditeur', value: 'editor' },
    { label: 'Lecteur', value: 'viewer' },
  ];

  ngOnInit(): void {
  this.initialized = false;
  const id = this.route.snapshot.paramMap.get('id');
  if (id) this.facade.loadTrip(id);
}

ngOnDestroy(): void {
  this.facade.unloadTrip();
}

readonly tripTitle = computed(() => {
  const id = this.route.snapshot.paramMap.get('id');
  const fromList = this.facade.trips().find((t) => t.id === id);
  return fromList?.title ?? this.facade.activeTrip()?.title ?? '';
});


  readonly activeDay = signal<string>('info');
  private initialized = false;

  constructor() {
    // dans le constructor effect :
    effect(() => {
      const trip = this.facade.activeTrip();
      if (!trip || this.initialized) return;
      this.activeDay.set(this.getTodayId(trip));
      this.initialized = true;
    });
  }

  readonly tabs = computed(() => {
    const trip = this.facade.activeTrip();
    if (!trip) return [{ id: 'info', label: 'Général' }];
    return [
      { id: 'info', label: 'Général' },
      ...trip.days.map((d) => ({ id: d.id.toISOString(), label: this.formatDate(d.id) })),
    ];
  });

  // — invite dialog
  protected openInviteDialog(): void {
    this.inviteeEmail = '';
    this.inviteeRole = 'editor';
    this.inviteError.set(null);
    this.showInviteDialog = true;
  }

  protected closeInviteDialog(): void {
    this.showInviteDialog = false;
  }

  protected inviteCollaborator(): void {
    const tripId = this.route.snapshot.paramMap.get('id');
    if (!tripId || !this.inviteeEmail) return;

    this.inviteLoading.set(true);
    this.inviteError.set(null);

    this.collaborationService
      .addCollaborator(tripId, this.inviteeEmail, this.inviteeRole)
      .pipe(finalize(() => this.inviteLoading.set(false)))
      .subscribe({
        next: () => this.closeInviteDialog(),
        error: (err) => this.inviteError.set(err?.message ?? 'Une erreur est survenue'),
      });
  }

  // — tabs
  nextTab(): void { this.moveTab(1); }
  prevTab(): void { this.moveTab(-1); }

  protected onTabChange(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected formatDate(date: Date): string {
    return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(date);
  }

  private moveTab(offset: number): void {
    const list = this.tabs().map((t) => t.id);
    const i = list.indexOf(this.activeDay());
    const next = list[i + offset];
    if (next) this.activeDay.set(next);
  }

  private getTodayId(trip: Trip): string {
    const today = new Date().toDateString();
    const day = trip.days.find((d) => new Date(d.id).toDateString() === today);
    return day ? day.id.toISOString() : 'info';
  }
}