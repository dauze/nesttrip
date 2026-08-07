import { Observable, filter, map, of, take } from 'rxjs';
import { CurrencyConversionService } from '@app/core/services/currency-conversion.service';

/**
 * Taux figé dès la saisie (pas de statut réservé/à réserver pour une
 * dépense libre, voir src/specs/devise.md 3.4) — attend le premier état
 * NON "loading" de `convert$` (une seule résolution, pas un flux continu) :
 * une dépense libre a besoin d'une vraie valeur figée à la création/édition,
 * pas d'une valeur par défaut silencieuse. `status === 'error'` (offline)
 * retombe sur un taux 1 en dernier recours plutôt que de bloquer la saisie
 * indéfiniment. Utilisé par `ExpensesTableDialogComponent` (création) ET
 * `ExpenseDetailDialogComponent` (édition du montant).
 */
export function resolveFrozenEur(
  currencyConversionService: CurrencyConversionService,
  amount: number,
  currency: string,
): Observable<{ frozenRateToEur: number; frozenAmountEur: number }> {
  if (currency === 'EUR') return of({ frozenRateToEur: 1, frozenAmountEur: amount });

  return currencyConversionService.convert$(amount, currency, 'EUR').pipe(
    filter((state) => state.status !== 'loading'),
    take(1),
    map((state) =>
      state.status === 'success'
        ? { frozenRateToEur: state.data.amount / amount, frozenAmountEur: state.data.amount }
        : { frozenRateToEur: 1, frozenAmountEur: amount },
    ),
  );
}
