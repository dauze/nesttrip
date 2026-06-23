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
import { Day, Trip, TripMember } from '../trip.model';
import { TripRole } from '../trip.model';
import { DayPanelComponent } from './day-panel/day-panel.component';
import { InfosComponent } from './infos/infos.component';
import { InfosSkeletonComponent } from './infos/infos-skeleton.component';
import { finalize } from 'rxjs';
import { TripFacade } from '../trip-facade.service';
import { CollaborationService } from '@app/core/services/collaboration.service';
import { AvatarModule } from 'primeng/avatar';
import { AvatarGroupModule } from 'primeng/avatargroup';
import { TooltipModule } from 'primeng/tooltip';
import { SwipeDirective } from '@app/shared/directives/swipe.directive';
import { AutoResizeFixDirective } from '@app/shared/pipes/auto-resize-area.pipe';
import { Textarea } from 'primeng/textarea';
import { DatePickerModule } from 'primeng/datepicker';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';

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
    InfosSkeletonComponent,
    AvatarModule, 
    AvatarGroupModule,
    TooltipModule,
    Textarea,
    SwipeDirective,
    AutoResizeFixDirective,
    DatePickerModule,
    ReactiveFormsModule
  ],
  providers: [ConfirmationService],
  templateUrl: 'trip-detail.component.html',
  styleUrl: 'trip-detail.component.scss',
})
export class TripDetailComponent implements OnInit, OnDestroy {
  protected readonly facade = inject(TripFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly collaborationService = inject(CollaborationService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly fb = inject(FormBuilder);

  // — dialog state
  protected showInviteDialog = false;
  protected inviteeEmail = '';
  protected inviteeRole: TripRole = 'editor';
  protected readonly inviteLoading = signal(false);
  protected readonly inviteError = signal<string | null>(null);
  protected objectEntries = Object.entries;
  private readonly MAX_VISIBLE = 5;

  readonly visitedDays = signal<Set<string>>(new Set());
  readonly tripForm = this.fb.group({
    dates: this.fb.control<Date[] | null>(null),
  });


    getInitials(member: TripMember): string {
  if (member.displayName) {
    return member.displayName
      .split(' ')
      .map(n => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }
  return member.email.slice(0, 2).toUpperCase();
}
getVisibleMembers(): [string, TripMember][] {
  const members = this.facade.activeTrip()?.members ?? {};
  return Object.entries(members).slice(0, this.MAX_VISIBLE);
}

getExtraCount(): number {
  const total = Object.keys(this.facade.activeTrip()?.members ?? {}).length;
  return Math.max(0, total - this.MAX_VISIBLE);
}

getExtraTooltip(): string {
  const members = this.facade.activeTrip()?.members ?? {};
  return Object.keys(members)
    .slice(this.MAX_VISIBLE)
    .join(', ');
}

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
    effect(() => {
      const trip = this.facade.activeTrip();
      if (!trip || this.initialized) return;

      const todayId = this.getTodayId(trip);
      this.activeDay.set(todayId);
      this.visitedDays.set(new Set(['info', todayId]));
      this.initTripForm(trip);
      this.initialized = true;
    });
  }

  readonly tabs = computed(() => {
    const trip = this.facade.activeTrip();
    if (!trip) return [{ id: 'info', label: 'Général' }];
  
    return [
      { id: 'info', label: 'Général' },
      ...trip.days
        .slice()
        .sort((a, b) => a.id.getTime() - b.id.getTime())
        .map(d => ({
          id: d.id.toISOString(),
          label: this.formatDate(d.id)
        })),
    ];
  });

  confirmDelete(trip: Trip): void {
    this.confirmationService.confirm({
      message: 'Certains jours contiennent des activités et vont être supprimés. Êtes-vous sûr de vouloir continuer ?',
      accept: () => this.facade.updateTripTitle(trip)
    });
  }

  protected onDatesChange(): void {
    const trip = this.facade.activeTrip();
    if (!trip) return;

    const dates = this.tripForm.value.dates;
    if (!dates || !dates[0] || !dates[1]) return;

    const [start, end] = dates;

    const newDays = this.buildDays(start, end, trip.days);

    const toDelete = this.findDaysToDelete(trip.days, newDays);
    const toAdd = this.findDaysToAdd(trip.days, newDays);

    const applyChanges = () => {
      for (const day of toDelete) {
        this.facade.removeDay(
          trip.id,
          day.id
        );
      }

      for (const day of toAdd) {
        this.facade.addDay(
          trip.id,
          day
        );
      }
    };

    if (toDelete.length > 0) {
      this.confirmationService.confirm({
        message: 'Certains jours contiennent des activités et vont être supprimés. Êtes-vous sûr de vouloir continuer ?',
        accept: applyChanges
      });
    } else {
      applyChanges();
    }
  }

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
      next: () => {
        this.closeInviteDialog();
        this.inviteeEmail = '';  // reset propre
      },
      error: (err) => {
        const message = err?.error?.error ?? err?.message ?? 'Une erreur est survenue';
        this.inviteError.set(message);
      },
    });
}

  // — tabs
  nextTab(): void { this.moveTab(1); }
  prevTab(): void { this.moveTab(-1); }

  updateTitle(title: string) {
    const trip = this.facade.activeTrip();
    if (!trip || !title || title === trip.title) {
      return;
    }

    this.facade.updateTripTitle({
      ...trip,
      title
    });
  }

  protected onTabChange(value: string): void {
    this.visitedDays.update(s => new Set(s).add(value));
    this.activeDay.set(value);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected formatDate(date: Date): string {
    return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(date);
  }

  private moveTab(offset: number): void {
    const list = this.tabs().map((t) => t.id);
    const i = list.indexOf(this.activeDay());
    const next = list[i + offset];
    if (next) this.onTabChange(next);
  }

  private getTodayId(trip: Trip): string {
    const today = new Date().toDateString();
    const day = trip.days.find((d) => new Date(d.id).toDateString() === today);
    return day ? day.id.toISOString() : 'info';
  }

  private initTripForm(trip: Trip): void {
    if (!trip.days.length) return;

    const sortedDays = trip.days
      .slice()
      .sort((a, b) => a.id.getTime() - b.id.getTime());

    this.tripForm.patchValue({
      dates: [
        sortedDays[0].id,
        sortedDays[sortedDays.length - 1].id
      ]
    });
  }

  private buildDays(start: Date, end: Date, existingDays: Day[]): Day[] {
    const days: Day[] = [];

    const existingMap = new Map(
      existingDays.map(day => [
        day.id.getTime(),
        day
      ])
    );

    const current = new Date(start);
    current.setHours(0, 0, 0, 0);

    const endNorm = new Date(end);
    endNorm.setHours(0, 0, 0, 0);

    while (current <= endNorm) {
      const key = current.getTime();

      days.push(
        existingMap.get(key) ?? {
          id: new Date(current),
          activities: [],
        }
      );

      current.setDate(current.getDate() + 1);
    }

    return days;
  }

  private findDaysToAdd(existingDays: Day[], newDays: Day[]): Day[] {
    const existingIds = new Set(
      existingDays.map(d => d.id.getTime())
    );

    return newDays.filter(
      d => !existingIds.has(d.id.getTime())
    );
  }

  private findDaysToDelete(existingDays: Day[], newDays: Day[]): Day[] {
    const newIds = new Set(
      newDays.map(d => d.id.getTime())
    );

    return existingDays.filter(
      d => !newIds.has(d.id.getTime())
    );
  }
}