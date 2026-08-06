import { formatDistanceMeters } from './travel-format.util';

describe('formatDistanceMeters', () => {
  it('affiche en mètres arrondis sous 1 km', () => {
    expect(formatDistanceMeters(850)).toBe('850 m');
    expect(formatDistanceMeters(12.4)).toBe('12 m');
  });

  it('affiche en km avec 1 décimale (virgule) sous 10 km', () => {
    expect(formatDistanceMeters(2500)).toBe('2,5 km');
    expect(formatDistanceMeters(1000)).toBe('1,0 km');
  });

  it('affiche en km sans décimale à partir de 10 km', () => {
    expect(formatDistanceMeters(12000)).toBe('12 km');
    expect(formatDistanceMeters(9999)).toBe('10,0 km');
  });
});
