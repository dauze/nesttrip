import { expenseFromFb, expenseToFb } from './expense.mapper';
import { ExpenseFirebase } from '../models/expense.dto';
import { Expense } from '@app/core/models/expense.dto';

describe('expense.mapper', () => {
  const date = new Date('2026-08-10T12:00:00Z');

  const domain: Expense = {
    id: 'exp-1',
    amount: 5,
    currency: 'THB',
    label: 'Smoothie',
    date,
    frozenRateToEur: 39.4,
    frozenAmountEur: 0.13,
  };

  describe('expenseToFb', () => {
    it('sérialise la date en epoch ms (string)', () => {
      expect(expenseToFb(domain).date).toBe(String(date.getTime()));
    });
  });

  describe('expenseFromFb', () => {
    it('lit une dépense telle quelle', () => {
      const fb: ExpenseFirebase = {
        id: 'exp-1',
        amount: 5,
        currency: 'THB',
        label: 'Smoothie',
        date: String(date.getTime()),
        frozenRateToEur: 39.4,
        frozenAmountEur: 0.13,
      };

      expect(expenseFromFb(fb)).toEqual(domain);
    });
  });

  it('est symétrique (fromFb ∘ toFb)', () => {
    expect(expenseFromFb(expenseToFb(domain))).toEqual(domain);
  });
});
