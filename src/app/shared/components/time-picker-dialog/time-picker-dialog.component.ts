import {
    ChangeDetectionStrategy,
    Component,
    forwardRef,
    inject,
    input,
    output,
    signal
} from '@angular/core';

import { CommonModule } from '@angular/common';

import {
    ControlValueAccessor,
    NG_VALUE_ACCESSOR
} from '@angular/forms';

import { DialogService } from '@app/shared/services/dialog.service';
import { ViewportService } from '@core/services/viewport.service';
import { TimePickerClockComponent, TimePickerClockData, TimePickerMode } from './time-picker-clock/time-picker-clock.component';
import { TimeFieldsComponent } from './time-fields/time-fields.component';

/**
 * Remplacement maison de `p-dialog` (Phase 7c de la sortie de PrimeNG, voir
 * PRIMENG_MIGRATION.md). Contrairement à `CollaboratorsDialog`, le dialog ici
 * n'était pas ouvert par un appelant externe : ce composant EST à la fois le
 * déclencheur (la zone cliquable affichant l'heure) et hébergeait directement
 * son `<p-dialog>` dans son propre template. `DialogService.open()` instancie
 * un composant dynamiquement (pas un `<ng-template>` local) : la logique du
 * cadran a donc été extraite dans `TimePickerClockComponent`, ce composant-ci
 * ne gardant que le déclencheur et le `ControlValueAccessor`.
 *
 * Sur desktop (voir `ViewportService`), le dialog/cadran n'est pas pertinent
 * (interaction tactile) : le composant affiche directement 2 champs texte
 * HH/MM (`TimeFieldsComponent`) au lieu du déclencheur cliquable.
 */
@Component({
    selector: 'app-time-picker-dialog',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule,
        TimeFieldsComponent
    ],
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(
                () => TimePickerDialogComponent
            ),
            multi: true
        }
    ],
    templateUrl: './time-picker-dialog.component.html',
    styleUrls: ['./time-picker-dialog.component.scss']
})
export class TimePickerDialogComponent
    implements ControlValueAccessor {

    private readonly dialogService = inject(DialogService);
    protected readonly viewport = inject(ViewportService);

    /** 'duration' désactive le cadran horloge (une durée n'est pas une heure sur 24h) : saisie clavier uniquement. */
    readonly mode = input<TimePickerMode>('time');

    /** Titre du dialog mobile (ex. "Sélectionner l'heure de début") — retombe sur un libellé générique selon `mode` si non fourni, voir TimePickerClockComponent. */
    readonly label = input<string>('');

    currentDate = signal<Date | null>(null);

    displayText = signal('--:--');

    hourText = signal('00');
    minuteText = signal('00');

    onChange?: (value: Date | null) => void;

    onTouch?: () => void;

    /** Émis à la fermeture du dialog, `undefined` si annulé sans choix — utilisé par le chaînage de saisie guidée (voir ActivityFormComponent.startGuidedEntry). */
    readonly closed = output<Date | undefined>();

    writeValue(
        value: Date | null
    ): void {

        this.currentDate.set(value);

        if (value instanceof Date) {

            const hour = String(value.getHours()).padStart(2, '0');
            const minute = String(value.getMinutes()).padStart(2, '0');
            this.hourText.set(hour);
            this.minuteText.set(minute);
            this.displayText.set(`${hour}:${minute}`);

        } else {

            this.hourText.set('00');
            this.minuteText.set('00');
            this.displayText.set('--:--');
        }
    }

    registerOnChange(fn: (value: Date | null) => void): void {
        this.onChange = fn;
    }

    registerOnTouched(fn: () => void): void {
        this.onTouch = fn;
    }

    openDialog(): void {
        const dialogRef = this.dialogService.open<Date | undefined, TimePickerClockData>(TimePickerClockComponent, {
            data: { initialDate: this.currentDate(), mode: this.mode(), label: this.label() },
            // Mode durée : le dialog s'ouvre directement en vue clavier (pas de
            // cadran). Le focus initial du champ heure passe par ce sélecteur
            // CDK plutôt que par un `effect()` côté TimePickerClockComponent :
            // l'autofocus interne du dialog (`DialogService` -> 'first-tabbable'
            // par défaut) s'exécute au moment même de l'ouverture et gagnerait
            // sinon la course contre un focus posé après coup (voir le
            // commentaire sur `ngAfterViewInit`/`clockSize` dans
            // TimePickerClockComponent pour un souci de timing similaire).
            ...(this.mode() === 'duration' ? { autoFocus: 'input[aria-label="Heures"]' } : {}),
        });

        dialogRef.closed.subscribe((selected) => {
            if (!selected) {
                this.closed.emit(undefined);
                return;
            }
            this.applySelectedDate(selected);
            this.closed.emit(selected);
        });
    }

    onHourFieldChange(value: string): void {
        const current = this.currentDate();
        const date = current ? new Date(current) : new Date();
        date.setHours(Number(value) || 0, date.getMinutes(), 0, 0);
        this.applySelectedDate(date);
    }

    onMinuteFieldChange(value: string): void {
        const current = this.currentDate();
        const date = current ? new Date(current) : new Date();
        date.setMinutes(Number(value) || 0, 0, 0);
        this.applySelectedDate(date);
    }

    private applySelectedDate(date: Date): void {
        const hour = String(date.getHours()).padStart(2, '0');
        const minute = String(date.getMinutes()).padStart(2, '0');
        this.currentDate.set(date);
        this.hourText.set(hour);
        this.minuteText.set(minute);
        this.displayText.set(`${hour}:${minute}`);
        this.onChange?.(date);
        this.onTouch?.();
    }
}
