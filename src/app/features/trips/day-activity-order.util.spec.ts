import { insertChronologically } from './day-activity-order.util';

describe('insertChronologically', () => {
  const times: Record<string, string | undefined> = {
    morning: '09:00',
    noon: '12:00',
    evening: '18:00',
  };
  const getStartTime = (id: string) => times[id];

  it('insère entre deux activités datées selon son heure', () => {
    const result = insertChronologically(['morning', 'evening'], 'noon', '12:00', getStartTime);
    expect(result).toEqual(['morning', 'noon', 'evening']);
  });

  it('insère en tête si son heure précède toutes les autres', () => {
    const result = insertChronologically(['noon', 'evening'], 'morning', '09:00', getStartTime);
    expect(result).toEqual(['morning', 'noon', 'evening']);
  });

  it('insère en fin si son heure suit toutes les autres', () => {
    const result = insertChronologically(['morning', 'noon'], 'evening', '18:00', getStartTime);
    expect(result).toEqual(['morning', 'noon', 'evening']);
  });

  it('ignore les activités non datées pour la comparaison, sans les déplacer', () => {
    const withUntimed: Record<string, string | undefined> = { ...times, 'untimed-a': undefined, 'untimed-b': undefined };
    const result = insertChronologically(
      ['untimed-b', 'untimed-a', 'morning', 'evening'],
      'noon',
      '12:00',
      (id) => withUntimed[id],
    );
    expect(result).toEqual(['untimed-b', 'untimed-a', 'morning', 'noon', 'evening']);
  });

  it("retire l'id déplacé de sa position d'origine avant de le réinsérer", () => {
    const result = insertChronologically(['noon', 'morning', 'evening'], 'noon', '12:00', getStartTime);
    expect(result).toEqual(['morning', 'noon', 'evening']);
  });
});
