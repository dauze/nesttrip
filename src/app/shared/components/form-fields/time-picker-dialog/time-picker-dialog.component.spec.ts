import { Subject } from 'rxjs';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DialogService } from '@app/shared/services/dialog.service';
import { ViewportService } from '@core/services/ui/viewport.service';
import { TimePickerDialogComponent } from './time-picker-dialog.component';

describe('TimePickerDialogComponent', () => {
  let closedSubject: Subject<Date | undefined>;
  let openSpy: ReturnType<typeof vi.fn>;
  let fixture: ComponentFixture<TimePickerDialogComponent>;
  let component: TimePickerDialogComponent;

  beforeEach(() => {
    closedSubject = new Subject<Date | undefined>();
    openSpy = vi.fn().mockReturnValue({ closed: closedSubject.asObservable() });

    TestBed.configureTestingModule({
      imports: [TimePickerDialogComponent],
      providers: [
        { provide: DialogService, useValue: { open: openSpy } },
        { provide: ViewportService, useValue: { isMobile: () => true } },
      ],
    });

    fixture = TestBed.createComponent(TimePickerDialogComponent);
    component = fixture.componentInstance;
    component.registerOnChange(() => undefined);
    component.registerOnTouched(() => undefined);
  });

  /**
   * Reproduit le bug rapporté par l'utilisateur (ROADMAP.md "Bugs / fixes",
   * "le positionnement de j+0 à j+1 ne fait rien") : sélectionner un offset
   * "J+1" explicite via les flèches du dialog (TimePickerClockComponent) sur
   * une heure de fin qui, comparée seule, n'est pas "avant" l'heure de début
   * (donc ne "franchit pas minuit" au sens naïf) ne doit PAS être écrasé par
   * le recalcul automatique de `ActivityFormComponent.syncEndDayOffsetFromTimes`,
   * qui s'exécute suite au changement d'heure de fin (`closed`) — l'offset
   * explicite (`dayOffsetChange`) doit donc être appliqué APRÈS ce recalcul,
   * jamais avant.
   */
  it("émet `closed` (nouvelle heure) avant `dayOffsetChange` (offset explicite), pour que l'offset gagne sur le recalcul automatique", () => {
    fixture.componentRef.setInput('dayOffsetReference', new Date(2026, 0, 1, 10, 0));
    fixture.componentRef.setInput('dayOffset', 0);
    fixture.detectChanges();

    const emissionOrder: string[] = [];
    component.closed.subscribe(() => emissionOrder.push('closed'));
    component.dayOffsetChange.subscribe(() => emissionOrder.push('dayOffsetChange'));

    component.writeValue(new Date(2026, 0, 1, 10, 0));
    component.openDialog();

    const dataArg = openSpy.mock.calls[0][1].data as { dayOffset?: { value: number } };
    // Simule l'utilisateur ayant cliqué la flèche droite dans le dialog (J+0 -> J+1).
    dataArg.dayOffset!.value = 1;

    // Heure de fin choisie (11:00) : postérieure à l'heure de début (10:00),
    // donc PAS "avant minuit" au sens naïf — c'est exactement le cas qui
    // déclenchait le recalcul automatique côté form.
    closedSubject.next(new Date(2026, 0, 1, 11, 0));

    expect(emissionOrder).toEqual(['closed', 'dayOffsetChange']);
  });

  it("n'émet jamais `dayOffsetChange` sur Annuler (aucune sélection)", () => {
    fixture.componentRef.setInput('dayOffsetReference', new Date(2026, 0, 1, 10, 0));
    fixture.componentRef.setInput('dayOffset', 0);
    fixture.detectChanges();

    const emissionOrder: string[] = [];
    component.closed.subscribe(() => emissionOrder.push('closed'));
    component.dayOffsetChange.subscribe(() => emissionOrder.push('dayOffsetChange'));

    component.openDialog();
    closedSubject.next(undefined);

    expect(emissionOrder).toEqual(['closed']);
  });
});
