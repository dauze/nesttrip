import {
    Component,
    forwardRef,
    inject,
    input,
    output
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

    currentDate: Date | null = null;

    displayText = '--:--';

    hourText = '00';
    minuteText = '00';

    onChange?: (value: Date | null) => void;

    onTouch?: () => void;

    /** Émis à la fermeture du dialog, `undefined` si annulé sans choix — utilisé par le chaînage de saisie guidée (voir ActivityFormComponent.startGuidedEntry). */
    readonly closed = output<Date | undefined>();

    writeValue(
        value: Date | null
    ): void {

        this.currentDate = value;

        if (value instanceof Date) {

            this.hourText = String(value.getHours()).padStart(2, '0');
            this.minuteText = String(value.getMinutes()).padStart(2, '0');
            this.displayText = `${this.hourText}:${this.minuteText}`;

        } else {

            this.hourText = '00';
            this.minuteText = '00';
            this.displayText = '--:--';
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
            data: { initialDate: this.currentDate, mode: this.mode(), label: this.label() },
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
        const date = this.currentDate ? new Date(this.currentDate) : new Date();
        date.setHours(Number(value) || 0, date.getMinutes(), 0, 0);
        this.applySelectedDate(date);
    }

    onMinuteFieldChange(value: string): void {
        const date = this.currentDate ? new Date(this.currentDate) : new Date();
        date.setMinutes(Number(value) || 0, 0, 0);
        this.applySelectedDate(date);
    }

    private applySelectedDate(date: Date): void {
        this.currentDate = date;
        this.hourText = String(date.getHours()).padStart(2, '0');
        this.minuteText = String(date.getMinutes()).padStart(2, '0');
        this.displayText = `${this.hourText}:${this.minuteText}`;
        this.onChange?.(this.currentDate);
        this.onTouch?.();
    }
}
