import {
    Component,
    forwardRef,
    inject
} from '@angular/core';

import { CommonModule } from '@angular/common';

import {
    ControlValueAccessor,
    NG_VALUE_ACCESSOR
} from '@angular/forms';

import { DialogService } from '@app/shared/services/dialog.service';
import { TimePickerClockComponent, TimePickerClockData } from './time-picker-clock/time-picker-clock.component';

/**
 * Remplacement maison de `p-dialog` (Phase 7c de la sortie de PrimeNG, voir
 * PRIMENG_MIGRATION.md). Contrairement à `CollaboratorsDialog`, le dialog ici
 * n'était pas ouvert par un appelant externe : ce composant EST à la fois le
 * déclencheur (la zone cliquable affichant l'heure) et hébergeait directement
 * son `<p-dialog>` dans son propre template. `DialogService.open()` instancie
 * un composant dynamiquement (pas un `<ng-template>` local) : la logique du
 * cadran a donc été extraite dans `TimePickerClockComponent`, ce composant-ci
 * ne gardant que le déclencheur et le `ControlValueAccessor`.
 */
@Component({
    selector: 'app-time-picker-dialog',
    standalone: true,
    imports: [
        CommonModule
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

    currentDate: Date | null = null;

    displayText = '--:--';

    onChange?: (value: Date | null) => void;

    onTouch?: () => void;

    writeValue(
        value: Date | null
    ): void {

        this.currentDate = value;

        if (value instanceof Date) {

            this.displayText =
                `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;

        } else {

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
            data: { initialDate: this.currentDate },
        });

        dialogRef.closed.subscribe((selected) => {
            if (!selected) return;
            this.currentDate = selected;
            this.displayText =
                `${String(selected.getHours()).padStart(2, '0')}:${String(selected.getMinutes()).padStart(2, '0')}`;
            this.onChange?.(this.currentDate);
            this.onTouch?.();
        });
    }
}
