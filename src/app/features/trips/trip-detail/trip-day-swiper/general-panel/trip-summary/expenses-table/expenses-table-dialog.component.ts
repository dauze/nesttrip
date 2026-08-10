import { ChangeDetectionStrategy, Component, ViewContainerRef, computed, inject, signal, viewChild } from '@angular/core';
import { AsyncPipe, DatePipe, DecimalPipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';

import { DialogFrameComponent } from '@app/shared/components/dialog-frame/dialog-frame.component';
import { ButtonComponent } from '@app/shared/components/button/button.component';
import { CheckboxComponent } from '@app/shared/components/checkbox/checkbox.component';
import { MessageComponent } from '@app/shared/components/message/message.component';
import { DatePickerComponent } from '@app/shared/components/date-picker/date-picker.component';
import { SelectableDirective } from '@app/shared/directives/selectable.directive';
import { LongPressDirective } from '@app/shared/directives/long-press.directive';
import { SelectableItemRef, SelectionModeService } from '@app/shared/services/selection-mode.service';
import { DialogService } from '@app/shared/services/dialog.service';
import { TripFacade } from '@app/features/trips/trip-facade.service';
import { UserProfileService } from '@app/core/services/user-profile.service';
import { CurrencyConversionService, ConvertedAmount } from '@app/core/services/currency-conversion.service';
import { LoadingState } from '@app/core/models/place.dto';
import { CURRENCY_OPTIONS } from '@app/shared/components/activity-card/activity.constants';
import { ConfirmDialogService } from '@app/shared/services/confirm-dialog.service';
import { Expense } from '@app/core/models/expense.dto';
import { PriceEditDialogComponent, PriceEditDialogData } from '@app/shared/components/price-field/price-edit-dialog/price-edit-dialog.component';
import { SimpleTextEntryDialogComponent, SimpleTextEntryDialogData } from '@app/shared/components/simple-text-entry-dialog/simple-text-entry-dialog.component';
import { resolveFrozenEur } from './expense-currency.util';
import { ViewportService } from '@app/core/services/viewport.service';

export interface ExpensesTableDialogData {
  tripId: string;
}

interface ExpenseRow {
  key: string;
  label: string;
  date: Date | undefined;
  amount: number;
  currency: string;
  /** Montant EUR figé (statut `BOOKED`, ou toujours pour une dépense libre — voir src/specs/devise.md 3.3/3.4) — `undefined` tant que dynamique (`TO_BOOK`/`NOT_NEEDED`/`WAITLIST`). Prime sur `amount`/`currency` pour la conversion affichée, voir `convertedAmount$`. */
  frozenAmountEur: number | undefined;
  /** Réutilise le vrai type d'entité (dayActivityInstance/logistic/expense) — permet à `deleteSelected` de filtrer les lignes réellement supprimables sans introduire un nouveau kind fictif, voir sa doc. */
  selectableRef: SelectableItemRef;
  /** Présent uniquement pour une dépense libre — pilote le style grisé/lecture seule et le clic pour éditer (voir src/specs/devise.md 3.5). */
  expense: Expense | undefined;
}

/**
 * Tableau détaillé de toutes les dépenses du voyage (voir src/specs/devise.md
 * 3.5), ouvert depuis le lien "voir toutes les dépenses" sous l'anneau
 * (`TripSummaryComponent`). 3 colonnes : montant converti dans la devise de
 * l'utilisateur courant, libellé, date — pour une dépense libre, chaque
 * colonne est un bouton cliquable indépendamment, ouvrant directement SON
 * dialog isolé (`openAmountDialog`/`openLabelDialog`/`openDatePanel`), plus
 * une icône poubelle en fin de ligne (`deleteExpense`) : pas de vue détail
 * intermédiaire (retour utilisateur — l'ancien `ExpenseDetailDialogComponent`
 * a été retiré). Instance dédiée de `SelectionModeService` (pas celle de
 * l'écran trip-detail derrière) : le mode sélection de ce tableau ne doit
 * jamais interagir avec une sélection en cours ailleurs dans l'app.
 */
@Component({
  selector: 'app-expenses-table-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    DialogFrameComponent,
    ButtonComponent,
    CheckboxComponent,
    MessageComponent,
    DatePickerComponent,
    SelectableDirective,
    LongPressDirective,
    DatePipe,
    DecimalPipe,
    AsyncPipe,
  ],
  templateUrl: './expenses-table-dialog.component.html',
  styleUrl: './expenses-table-dialog.component.scss',
  providers: [SelectionModeService],
})
export class ExpensesTableDialogComponent {
  private readonly dialogRef = inject(DialogRef<void>);
  protected readonly data = inject<ExpensesTableDialogData>(DIALOG_DATA);
  private readonly tripFacade = inject(TripFacade);
  private readonly userProfileService = inject(UserProfileService);
  private readonly currencyConversionService = inject(CurrencyConversionService);
  private readonly dialogService = inject(DialogService);
  private readonly confirmDialogService = inject(ConfirmDialogService);
  private readonly viewContainerRef = inject(ViewContainerRef);
  protected readonly selectionService = inject(SelectionModeService);
  protected readonly viewport = inject(ViewportService);

  protected readonly currencyOptions = CURRENCY_OPTIONS;
  protected readonly blockedMessage = signal<string | null>(null);

  private readonly targetCurrency = computed(() => this.userProfileService.defaultCurrency());
  protected readonly targetCurrencySymbol = computed(
    () => this.currencyOptions.find((o) => o.value === this.targetCurrency())?.label.split(' ')[0] ?? this.targetCurrency(),
  );

  protected close(): void {
    this.dialogRef.close();
  }

  /**
   * Toutes les dépenses du trip, dépenses libres + activités/réservations au
   * prix renseigné (>0), triées par date décroissante (plus récent en haut).
   * Une activité placée sur 2 jours produit 2 lignes — même convention que
   * `TripSummaryComponent.allPlacedActivities`.
   */
  protected readonly rows = computed<ExpenseRow[]>(() => {
    const tripId = this.data.tripId;
    const rows: ExpenseRow[] = [];

    for (const expense of this.tripFacade.getAllExpenses(tripId)()) {
      rows.push({
        key: `expense:${expense.id}`,
        label: expense.label,
        date: expense.date,
        amount: expense.amount,
        currency: expense.currency,
        frozenAmountEur: expense.frozenAmountEur,
        selectableRef: { kind: 'expense', id: expense.id },
        expense,
      });
    }

    const trip = this.tripFacade.activeTrip();
    if (trip && trip.id === tripId) {
      for (const day of trip.days) {
        for (const activity of this.tripFacade.getDayActivities(day.id)()) {
          const amount = activity.price?.amount || 0;
          if (amount <= 0) continue;
          rows.push({
            key: `activity:${activity.id}`,
            label: activity.title,
            date: day.id,
            amount,
            currency: activity.price.currency,
            frozenAmountEur: activity.price.frozenAmountEur,
            selectableRef: { kind: 'dayActivityInstance', id: activity.id, dayId: day.id },
            expense: undefined,
          });
        }
      }
    }

    for (const logistic of this.tripFacade.getAllLogistics(tripId)()) {
      const amount = logistic.price?.amount || 0;
      if (amount <= 0) continue;
      rows.push({
        key: `logistic:${logistic.id}`,
        label: logistic.title,
        date: logistic.startDateTime,
        amount,
        currency: logistic.price!.currency,
        frozenAmountEur: logistic.price!.frozenAmountEur,
        selectableRef: { kind: 'logistic', id: logistic.id },
        expense: undefined,
      });
    }

    return rows.sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
  });

  private readonly convertedByKey = new Map<string, Observable<LoadingState<ConvertedAmount>>>();

  /**
   * Montant converti (mémoïsé par clé montant+devise+cible, voir
   * CurrencyConversionService) — consommé via `| async` dans le template,
   * PAS `toSignal` : cette méthode est appelée depuis un `@for` (contexte
   * réactif de rendu), où `toSignal()` lève NG0602 ("cannot be called from
   * within a reactive context"). La mémoïsation évite malgré tout une
   * nouvelle souscription à chaque cycle de détection de changement — même
   * rôle que `TravelDistanceService.routeCache`. `frozenAmountEur` présent
   * (statut `BOOKED`/dépense libre, voir src/specs/devise.md 3.3/3.4) :
   * reconverti depuis le montant EUR figé, jamais depuis `amount`/`currency`
   * d'origine — c'est ce qui rend ce montant stable dans le temps.
   */
  protected convertedAmount$(row: ExpenseRow): Observable<LoadingState<ConvertedAmount>> {
    const target = this.targetCurrency();
    const [amount, currency] = row.frozenAmountEur !== undefined ? [row.frozenAmountEur, 'EUR'] : [row.amount, row.currency];
    const key = `${amount}:${currency}:${target}`;
    let obs$ = this.convertedByKey.get(key);
    if (!obs$) {
      obs$ = this.currencyConversionService.convert$(amount, currency, target);
      this.convertedByKey.set(key, obs$);
    }
    return obs$;
  }

  /** Ancre hors-flux pour le panneau de date (dernière étape du chaînage de création, voir `.html`/`.scss`) — 2 instances `app-date-picker` dans ce template (création + édition), d'où le ciblage par référence nommée plutôt que par type. */
  private readonly createDatePickerRef = viewChild.required<DatePickerComponent>('createDatePicker');
  protected readonly createDateControl = new FormControl<Date>(new Date(), { nonNullable: true });
  private pendingCreatePrice?: { amount: number; currency: string };
  private pendingCreateLabel?: string;

  /**
   * Chaînage direct montant -> libellé -> date, même pattern que
   * `ActivityFormComponent.startGuidedEntry`/`LogisticHeaderComponent` :
   * réutilise 3 composants déjà existants ailleurs dans l'app plutôt qu'un
   * dialog consolidé dédié (voir doc de `ExpenseDetailDialogComponent`,
   * même principe côté édition). Abandon silencieux à toute étape annulée.
   */
  protected openCreate(): void {
    this.dialogService.open<void, PriceEditDialogData>(PriceEditDialogComponent, {
      viewContainerRef: this.viewContainerRef,
      autoFocus: '.price-edit-dialog__amount',
      data: {
        initialAmount: null,
        initialCurrency: this.currencyOptions[0]?.value ?? 'EUR',
        currencyOptions: this.currencyOptions,
        title: 'Montant',
        onConfirm: (price) => {
          this.pendingCreatePrice = price;
          this.openCreateLabelStep();
        },
      },
    });
  }

  private openCreateLabelStep(): void {
    this.dialogService
      .open<string | undefined, SimpleTextEntryDialogData>(SimpleTextEntryDialogComponent, {
        viewContainerRef: this.viewContainerRef,
        autoFocus: '.simple-text-entry-dialog__input',
        data: { placeholder: 'Libellé (ex. Smoothie)', title: 'Libellé' },
      })
      .closed.subscribe((label) => {
        if (!label) return;
        this.pendingCreateLabel = label;
        this.createDatePickerRef().openPanel();
      });
  }

  protected onCreateDateSelected(value: Date | [Date, Date]): void {
    const price = this.pendingCreatePrice;
    const label = this.pendingCreateLabel;
    if (!price || !label) return;

    const date = Array.isArray(value) ? value[0] : value;
    resolveFrozenEur(this.currencyConversionService, price.amount, price.currency).subscribe((frozen) => {
      this.tripFacade.createExpense(this.data.tripId, {
        id: crypto.randomUUID(),
        amount: price.amount,
        currency: price.currency,
        label,
        date,
        ...frozen,
      });
    });

    this.pendingCreatePrice = undefined;
    this.pendingCreateLabel = undefined;
  }

  /**
   * Édition champ par champ directement depuis la ligne (retour utilisateur :
   * pas de vue détail séparée) — cliquer le montant/libellé/date d'une ligne
   * de dépense libre ouvre directement SON dialog isolé, pré-rempli, et
   * n'affecte que ce champ (`applyExpenseUpdate`) ; jamais pour une ligne
   * activité/logistique (`row.expense` alors `undefined`, voir template — le
   * mode sélection intercepte de toute façon ces clics en amont via la
   * capture posée par `SelectableDirective`).
   */
  protected openAmountDialog(expense: Expense): void {
    this.dialogService.open<void, PriceEditDialogData>(PriceEditDialogComponent, {
      viewContainerRef: this.viewContainerRef,
      autoFocus: '.price-edit-dialog__amount',
      data: {
        initialAmount: expense.amount,
        initialCurrency: expense.currency,
        currencyOptions: this.currencyOptions,
        title: 'Montant',
        onConfirm: (price) => {
          resolveFrozenEur(this.currencyConversionService, price.amount, price.currency).subscribe((frozen) => {
            this.applyExpenseUpdate(expense, { amount: price.amount, currency: price.currency, ...frozen });
          });
        },
      },
    });
  }

  protected openLabelDialog(expense: Expense): void {
    this.dialogService
      .open<string | undefined, SimpleTextEntryDialogData>(SimpleTextEntryDialogComponent, {
        viewContainerRef: this.viewContainerRef,
        autoFocus: '.simple-text-entry-dialog__input',
        data: { initialValue: expense.label, placeholder: 'Libellé (ex. Smoothie)', title: 'Libellé' },
      })
      .closed.subscribe((label) => {
        if (!label) return;
        this.applyExpenseUpdate(expense, { label });
      });
  }

  /** Ancre hors-flux pour le panneau de date d'édition — même technique que l'ancre de création ci-dessus, instance séparée pour ne pas mélanger les deux flux. */
  private readonly editDatePickerRef = viewChild.required<DatePickerComponent>('editDatePicker');
  protected readonly editDateControl = new FormControl<Date>(new Date(), { nonNullable: true });
  private editingExpense?: Expense;

  protected openDatePanel(expense: Expense): void {
    this.editingExpense = expense;
    this.editDateControl.setValue(expense.date);
    this.editDatePickerRef().openPanel();
  }

  protected onEditDateSelected(value: Date | [Date, Date]): void {
    const expense = this.editingExpense;
    if (!expense) return;
    this.applyExpenseUpdate(expense, { date: Array.isArray(value) ? value[0] : value });
    this.editingExpense = undefined;
  }

  private applyExpenseUpdate(expense: Expense, patch: Partial<Expense>): void {
    this.tripFacade.updateExpense(this.data.tripId, { ...expense, ...patch });
  }

  protected deleteExpense(expense: Expense): void {
    this.confirmDialogService.confirm({
      message: 'Supprimer cette dépense ?',
      accept: () => this.tripFacade.removeExpense(this.data.tripId, expense.id),
    });
  }

  protected deleteSelected(): void {
    const refs = this.selectionService.values();
    const expenseRefs = refs.filter((r) => r.kind === 'expense');
    const blockedCount = refs.length - expenseRefs.length;

    for (const ref of expenseRefs) {
      this.tripFacade.removeExpense(this.data.tripId, ref.id);
    }
    this.selectionService.cancel();

    this.blockedMessage.set(
      blockedCount > 0
        ? `${blockedCount} ligne${blockedCount > 1 ? 's' : ''} issue${blockedCount > 1 ? 's' : ''} d'une activité/réservation n'${blockedCount > 1 ? 'ont' : 'a'} pas été supprimée${blockedCount > 1 ? 's' : ''} — modifiez-les depuis leur carte source.`
        : null,
    );
  }

  protected dismissBlockedMessage(): void {
    this.blockedMessage.set(null);
  }
}
