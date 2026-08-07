import { suggestedCurrencyForCountry } from './country-currency.util';

describe('suggestedCurrencyForCountry', () => {
  it('mappe un pays connu vers sa devise supportée', () => {
    expect(suggestedCurrencyForCountry('TH')).toBe('THB');
    expect(suggestedCurrencyForCountry('JP')).toBe('JPY');
  });

  it('est insensible à la casse (Google renvoie parfois en minuscules)', () => {
    expect(suggestedCurrencyForCountry('th')).toBe('THB');
  });

  it('mappe tout pays de la zone euro vers EUR', () => {
    expect(suggestedCurrencyForCountry('DE')).toBe('EUR');
    expect(suggestedCurrencyForCountry('PT')).toBe('EUR');
  });

  it('renvoie undefined pour un pays inconnu de la table', () => {
    expect(suggestedCurrencyForCountry('KE')).toBeUndefined();
  });

  it('renvoie undefined si aucun countryCode', () => {
    expect(suggestedCurrencyForCountry(undefined)).toBeUndefined();
  });
});
