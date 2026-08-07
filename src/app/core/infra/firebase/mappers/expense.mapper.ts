import { Expense } from '@app/core/models/expense.dto';
import { ExpenseFirebase } from '../models/expense.dto';

export function expenseFromFb(e: ExpenseFirebase): Expense {
  return {
    id: e.id,
    amount: e.amount,
    currency: e.currency,
    label: e.label,
    date: new Date(Number(e.date)),
    frozenRateToEur: e.frozenRateToEur,
    frozenAmountEur: e.frozenAmountEur,
  };
}

export function expenseToFb(e: Expense): ExpenseFirebase {
  return {
    id: e.id,
    amount: e.amount,
    currency: e.currency,
    label: e.label,
    date: String(e.date.getTime()),
    frozenRateToEur: e.frozenRateToEur,
    frozenAmountEur: e.frozenAmountEur,
  };
}
