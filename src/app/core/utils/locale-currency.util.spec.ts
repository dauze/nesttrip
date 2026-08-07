import { detectCurrencyFromLocale } from './locale-currency.util';

describe('detectCurrencyFromLocale', () => {
  it('mappe une locale langue+région connue vers sa devise', () => {
    expect(detectCurrencyFromLocale('ja-JP')).toBe('JPY');
    expect(detectCurrencyFromLocale('en-GB')).toBe('GBP');
  });

  it('distingue 2 locales de même langue mais de région différente (fr-FR vs fr-CA)', () => {
    expect(detectCurrencyFromLocale('fr-FR')).toBe('EUR');
    expect(detectCurrencyFromLocale('fr-CA')).toBe('CAD');
  });

  it('retombe sur EUR si la locale est inconnue', () => {
    expect(detectCurrencyFromLocale('sw-KE')).toBe('EUR');
  });

  it('retombe sur EUR si la locale est absente', () => {
    expect(detectCurrencyFromLocale(undefined)).toBe('EUR');
  });
});
