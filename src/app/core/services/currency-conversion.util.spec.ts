import { convertWithRates } from './currency-conversion.util';

describe('convertWithRates', () => {
  // Taux Frankfurter (base EUR) — valeurs d'exemple réalistes, pas les taux du jour.
  const rates = { USD: 1.08, JPY: 161.5, THB: 39.4, GBP: 0.85 };

  it('renvoie le montant inchangé si from === to (même sans taux disponible pour cette devise)', () => {
    expect(convertWithRates(100, 'XYZ', 'XYZ', rates)).toBe(100);
  });

  it('convertit EUR vers une devise cotée directement', () => {
    expect(convertWithRates(10, 'EUR', 'USD', rates)).toBeCloseTo(10.8, 5);
  });

  it('convertit une devise cotée vers EUR', () => {
    expect(convertWithRates(161.5, 'JPY', 'EUR', rates)).toBeCloseTo(1, 5);
  });

  it('croise 2 devises non-EUR via EUR (ex. THB -> JPY)', () => {
    // 39.4 THB = 1 EUR = 161.5 JPY -> 3940 THB = 100 EUR = 16150 JPY
    expect(convertWithRates(3940, 'THB', 'JPY', rates)).toBeCloseTo(16150, 1);
  });

  it('dérive AED via le peg fixe USD (Frankfurter/ECB ne suit pas AED)', () => {
    // 1 USD = 3.6725 AED -> 1.08 USD/EUR => 1.08 * 3.6725 AED pour 1 EUR
    const result = convertWithRates(1, 'EUR', 'AED', rates);
    expect(result).toBeCloseTo(1.08 * 3.6725, 5);
  });

  it('convertit entre AED et une devise cotée en passant par USD puis EUR', () => {
    const aedPerEur = rates.USD * 3.6725;
    expect(convertWithRates(aedPerEur, 'AED', 'EUR', rates)).toBeCloseTo(1, 5);
  });

  it("renvoie null si la devise cible n'a pas de taux disponible (ni cotée, ni AED)", () => {
    expect(convertWithRates(10, 'EUR', 'XYZ', rates)).toBeNull();
  });

  it("renvoie null si le peg AED est demandé mais que USD n'est pas dans les taux fournis", () => {
    expect(convertWithRates(10, 'EUR', 'AED', { JPY: 161.5 })).toBeNull();
  });
});
