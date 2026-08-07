import { inject, Injectable } from '@angular/core';
import { expenseToFb } from '@core/infra/firebase/mappers/expense.mapper';
import { Expense } from '@core/models/expense.dto';
import { deleteField, doc, updateDoc } from 'firebase/firestore';
import { FirebaseService } from '../../firebase.service';
import { DebounceWriter } from '../../shared/debounced-writer';

interface ExpenseUpdate {
  key: string;
  tripId: string;
  expense: Expense;
}

/**
 * Persiste chaque dépense libre individuellement dans
 * `trips/{tripId}.expenses.{id}` — entité transverse (non rattachée à une
 * activité/logement/transport, voir src/specs/devise.md 3.4), indépendante du
 * map `days`. Seule l'édition passe par le debounce ; création et suppression
 * sont des écritures directes non débouncées — même moule que `LogisticPersistenceService`.
 */
@Injectable({ providedIn: 'root' })
export class ExpensePersistenceService extends DebounceWriter<string, ExpenseUpdate> {
  private readonly db = inject(FirebaseService).db;

  constructor() { super(); }

  queueUpdate(tripId: string, expense: Expense) {
    const key = `${tripId}_${expense.id}`;
    this.queue(key, { key, tripId, expense });
  }

  protected override write(updates: ExpenseUpdate[]) {
    return Promise.all(
      updates.map((u) =>
        updateDoc(doc(this.db, 'trips', u.tripId.toString()), {
          [`expenses.${u.expense.id}`]: expenseToFb(u.expense),
        })
      )
    );
  }

  /** Écriture directe (non débouncée) : création. */
  create(tripId: string, expense: Expense): Promise<void> {
    return updateDoc(doc(this.db, 'trips', tripId), {
      [`expenses.${expense.id}`]: expenseToFb(expense),
    });
  }

  /** Écriture directe (non débouncée) : suppression. */
  remove(tripId: string, expenseId: string): Promise<void> {
    return updateDoc(doc(this.db, 'trips', tripId), {
      [`expenses.${expenseId}`]: deleteField(),
    });
  }
}
