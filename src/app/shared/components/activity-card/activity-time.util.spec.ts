import { resolveEndDayOffset, timeToMinutes } from './activity-time.util';

describe('timeToMinutes', () => {
  it('convertit une heure "HH:mm" en minutes depuis minuit', () => {
    expect(timeToMinutes('00:00')).toBe(0);
    expect(timeToMinutes('01:30')).toBe(90);
    expect(timeToMinutes('23:59')).toBe(1439);
  });
});

describe('resolveEndDayOffset', () => {
  it('renvoie endDayOffset tel quel dès qu\'il est explicitement renseigné, même à 0', () => {
    expect(resolveEndDayOffset('08:00', '17:00', 0)).toBe(0);
    expect(resolveEndDayOffset('22:00', '01:00', 3)).toBe(3);
  });

  it("retombe sur l'ancienne règle implicite en son absence : fin < début ⇒ 1", () => {
    expect(resolveEndDayOffset('22:00', '01:00', undefined)).toBe(1);
  });

  it("retombe sur 0 en son absence si la plage ne franchit pas minuit", () => {
    expect(resolveEndDayOffset('08:00', '17:00', undefined)).toBe(0);
  });

  it('renvoie 0 si une heure manque', () => {
    expect(resolveEndDayOffset(undefined, '17:00', undefined)).toBe(0);
    expect(resolveEndDayOffset('08:00', undefined, undefined)).toBe(0);
  });
});
