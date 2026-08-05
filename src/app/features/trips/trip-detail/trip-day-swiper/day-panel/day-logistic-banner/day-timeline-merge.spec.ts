import { mergeDayTimeline, pinnedLogisticOccurrences } from './day-timeline-merge';
import { LogisticDayOccurrence } from './logistic-day-occurrence';
import { DayActivityEntry, Activity } from '@app/shared/components/activity-card/activity.model';
import { ActivityType } from '@core/enums/activites-type.enum';
import { BookingStatus } from '@core/enums/booking.status';
import { Logistic } from '@core/models/logistic.dto';

function activityEntry(id: string, startTime: string | undefined): DayActivityEntry {
  const activity: Activity = {
    id,
    activityId: `pool-${id}`,
    title: id,
    type: ActivityType.ACTIVITE,
    duration: 60,
    startTime,
    price: { amount: 0, currency: 'EUR' },
    booking: { status: BookingStatus.NOT_NEEDED },
    notes: '',
    files: [],
    photoRefs: [],
  };
  return { kind: 'activity', activity };
}

function occurrence(role: string, time: string): LogisticDayOccurrence {
  const logistic: Logistic = {
    id: `log-${role}-${time}`,
    type: 'other',
    title: `Logistique ${role}`,
    files: [],
    links: [],
    booking: { status: BookingStatus.NOT_NEEDED },
  };
  const [h, m] = time.split(':').map(Number);
  const d = new Date('2026-08-02T00:00:00');
  d.setHours(h, m, 0, 0);
  return { logistic, role, time: d };
}

describe('pinnedLogisticOccurrences', () => {
  it('ne garde que les rôles "continuation" (Nuit sur place / En cours)', () => {
    const occurrences = [occurrence('Check-in', '15:00'), occurrence('Nuit sur place', '00:00'), occurrence('En cours', '00:00')];

    expect(pinnedLogisticOccurrences(occurrences).map((o) => o.role)).toEqual(['Nuit sur place', 'En cours']);
  });
});

describe('mergeDayTimeline', () => {
  it('insère les occurrences "frontière" au bon endroit chronologique parmi les activités', () => {
    const entries = [activityEntry('morning', '09:00'), activityEntry('evening', '18:00')];
    const occurrences = [occurrence('Check-in', '14:00')];

    const result = mergeDayTimeline(entries, occurrences);

    expect(result.map((e) => (e.kind === 'logistic' ? e.occurrence.role : e.kind === 'activity' ? e.activity.id : 'echo'))).toEqual([
      'morning', 'Check-in', 'evening',
    ]);
  });

  it('exclut les rôles "continuation" de la fusion', () => {
    const entries = [activityEntry('morning', '09:00')];
    const occurrences = [occurrence('Nuit sur place', '00:00')];

    const result = mergeDayTimeline(entries, occurrences);

    expect(result).toEqual(entries);
  });

  it('ne déplace jamais les activités non datées entre elles (une occurrence sans entrée datée après elle atterrit en fin de liste)', () => {
    const entries = [activityEntry('untimed-a', undefined), activityEntry('morning', '09:00'), activityEntry('untimed-b', undefined)];
    const occurrences = [occurrence('Départ', '12:00')];

    const result = mergeDayTimeline(entries, occurrences);

    // Aucune entrée datée après "morning" pour arrêter la recherche plus tôt :
    // même principe que insertChronologically (Décision 3), les non datées
    // croisées en chemin sont ignorées pour la comparaison mais ne sont
    // jamais déplacées.
    const ids = result.map((e) => (e.kind === 'logistic' ? 'Départ' : e.kind === 'activity' ? e.activity.id : 'echo'));
    expect(ids).toEqual(['untimed-a', 'morning', 'untimed-b', 'Départ']);
  });

  it('conserve le bon ordre relatif entre plusieurs occurrences logistiques, même passées en désordre', () => {
    const occurrences = [occurrence('Arrivée', '20:00'), occurrence('Check-in', '08:00')];

    const result = mergeDayTimeline([], occurrences);

    expect(result.map((e) => (e.kind === 'logistic' ? e.occurrence.role : 'n/a'))).toEqual(['Check-in', 'Arrivée']);
  });
});
