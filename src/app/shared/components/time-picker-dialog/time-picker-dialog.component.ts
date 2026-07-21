import {
    Component,
    ElementRef,
    ViewChild,
    forwardRef
} from '@angular/core';

import { CommonModule } from '@angular/common';

import {
    ControlValueAccessor,
    FormsModule,
    NG_VALUE_ACCESSOR
} from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';

interface ClockItem {
    label: string;
    value: number;
    x: string;
    y: string;
    inner?: boolean;
}

@Component({
    selector: 'app-time-picker-dialog',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ButtonModule,
        DialogModule
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

    @ViewChild('clockFace')
    clockFace!: ElementRef<HTMLDivElement>;

    currentDate: Date | null = null;

    visible = false;

    isDragging = false;

    displayText = '--:--';

    tempHour = '00';
    tempMinute = '00';

    selectionMode: 'hour' | 'minute' = 'hour';

    onChange: (value: Date | null) => void =
        () => {};

    onTouch: () => void =
        () => {};

    writeValue(
        value: Date | null
    ): void {

        this.currentDate = value;

        if (value instanceof Date) {

            this.tempHour =
                String(
                    value.getHours()
                ).padStart(2, '0');

            this.tempMinute =
                String(
                    value.getMinutes()
                ).padStart(2, '0');

            this.displayText =
                `${this.tempHour}:${this.tempMinute}`;

        } else {

            this.displayText = '--:--';
        }
    }

    registerOnChange(fn: any): void {
        this.onChange = fn;
    }

    registerOnTouched(fn: any): void {
        this.onTouch = fn;
    }

    openDialog(): void {

        this.selectionMode = 'hour';

        if (this.currentDate instanceof Date) {

            this.tempHour =
                String(
                    this.currentDate.getHours()
                ).padStart(2, '0');

            this.tempMinute =
                String(
                    this.currentDate.getMinutes()
                ).padStart(2, '0');

        } else {

            const now = new Date();

            this.tempHour =
                String(
                    now.getHours()
                ).padStart(2, '0');

            this.tempMinute =
                String(
                    now.getMinutes()
                ).padStart(2, '0');
        }

        this.visible = true;
    }

    close(): void {

        this.isDragging = false;
        this.visible = false;
    }

    validate(): void {

        const updatedDate =
            this.currentDate
                ? new Date(this.currentDate)
                : new Date();

        updatedDate.setHours(
            Number(this.tempHour),
            Number(this.tempMinute),
            0,
            0
        );

        this.currentDate = updatedDate;

        this.displayText =
            `${this.tempHour}:${this.tempMinute}`;

        this.onChange(this.currentDate);
        this.onTouch();

        this.close();
    }

    selectValue(
        value: string
    ): void {

        if (this.selectionMode === 'hour') {

            this.tempHour =
                value.padStart(2, '0');

            if (!this.isDragging) {
                this.selectionMode = 'minute';
            }

        } else {

            this.tempMinute =
                value.padStart(2, '0');
        }
    }

    startDrag(
        event: PointerEvent
    ): void {

        this.isDragging = true;

        (
            event.currentTarget as HTMLElement
        ).setPointerCapture(
            event.pointerId
        );

        this.updateSelectionFromPointer(
            event
        );
    }

    onDrag(
        event: PointerEvent
    ): void {

        if (!this.isDragging) {
            return;
        }

        this.updateSelectionFromPointer(
            event
        );
    }

    stopDrag(): void {

        this.isDragging = false;
    }

    private updateSelectionFromPointer(
        event: PointerEvent
    ): void {

        if (!this.clockFace) {
            return;
        }

        const rect =
            this.clockFace.nativeElement.getBoundingClientRect();

        const centerX =
            rect.left + rect.width / 2;

        const centerY =
            rect.top + rect.height / 2;

        const dx =
            event.clientX - centerX;

        const dy =
            event.clientY - centerY;

        const distance =
            Math.sqrt(
                dx * dx + dy * dy
            );

        let angle =
            Math.atan2(dy, dx) * 180 / Math.PI;

        angle += 90;

        if (angle < 0) {
            angle += 360;
        }

        if (this.selectionMode === 'hour') {

            const clockIndex =
                Math.round(angle / 30) % 12;

            const isInnerCircle =
                distance <= this.getInnerSelectionLimit();

            let hour: number;

            if (isInnerCircle) {

                hour =
                    clockIndex === 0
                        ? 12
                        : clockIndex;

            } else {

                hour =
                    clockIndex === 0
                        ? 0
                        : clockIndex + 12;
            }

            this.tempHour =
                String(hour).padStart(2, '0');

        } else {

            const minute =
                Math.round(angle / 6) % 60;

            this.tempMinute =
                String(minute).padStart(2, '0');
        }
    }

    get selectedValue(): string {

        return this.selectionMode === 'hour'
            ? String(
                Number(this.tempHour)
            )
            : String(
                Number(this.tempMinute)
            );
    }

    get currentValues(): ClockItem[] {

        if (this.selectionMode === 'minute') {

            return Array.from(
                { length: 12 },
                (_, i) => ({
                    label: String(i * 5),
                    value: i * 5,
                    ...this.computePosition(
                        i,
                        12,
                        false
                    )
                })
            );
        }

        const values: ClockItem[] = [];

        for (let hour = 1; hour <= 12; hour++) {

            values.push({
                label: String(hour),
                value: hour,
                inner: true,
                ...this.computePosition(
                    hour % 12,
                    12,
                    true
                )
            });
        }

        const outerHours = [
            0,
            13,
            14,
            15,
            16,
            17,
            18,
            19,
            20,
            21,
            22,
            23
        ];

        outerHours.forEach(
            (hour) => {

                values.push({
                    label: String(hour),
                    value: hour,
                    inner: false,
                    ...this.computePosition(
                        hour % 12,
                        12,
                        false
                    )
                });
            }
        );

        return values;
    }

    private computePosition(
        index: number,
        total: number,
        inner = false
    ) {

        const center =
            this.getClockCenter();

        const radius =
            inner
                ? this.getInnerRadius()
                : this.getOuterRadius();

        const angle =
            (
                (index * 360) / total - 90
            ) *
            (Math.PI / 180);

        const x =
            center +
            radius *
            Math.cos(angle);

        const y =
            center +
            radius *
            Math.sin(angle);

        return {
            x: `${x}px`,
            y: `${y}px`
        };
    }

    get handStyle() {

        let angle: number;
        let radius: number;

        if (this.selectionMode === 'hour') {

            const hour =
                Number(this.tempHour);

            angle =
                (hour % 12) * 30;

            radius =
                hour >= 1 && hour <= 12
                    ? this.getInnerRadius()
                    : this.getOuterRadius();

        } else {

            angle =
                Number(this.tempMinute) * 6;

            radius = this.getOuterRadius();
        }

        const center =
            this.getClockCenter();

        return {
            top: `${center - radius}px`,
            height: `${radius}px`,
            transform: `rotate(${angle}deg)`
        };
    }

    get selectorPosition() {

        let angle: number;
        let radius: number;

        if (this.selectionMode === 'hour') {

            const hour =
                Number(this.tempHour);

            angle =
                (hour % 12) * 30;

            radius =
                hour >= 1 && hour <= 12
                    ? this.getInnerRadius()
                    : this.getOuterRadius();

        } else {

            angle =
                Number(this.tempMinute) * 6;

            radius = this.getOuterRadius();
        }

        const center =
            this.getClockCenter();

        const radians =
            (angle - 90) *
            Math.PI / 180;

        const x =
            center +
            radius *
            Math.cos(radians);

        const y =
            center +
            radius *
            Math.sin(radians);

        return {
            left: `${x}px`,
            top: `${y}px`
        };
    }

    private getClockSize(): number {

        if (!this.clockFace) {
            return 280;
        }

        return this.clockFace.nativeElement.clientWidth;
    }

    private getClockCenter(): number {

        return this.getClockSize() / 2;
    }

    private getInnerRadius(): number {

        return this.getClockSize() * 0.280;
    }

    private getOuterRadius(): number {

        return this.getClockSize() * 0.410;
    }

    private getInnerSelectionLimit(): number {

        return this.getClockSize() * 0.37;
    }
}