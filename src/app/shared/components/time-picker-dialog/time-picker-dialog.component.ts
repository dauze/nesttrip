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

    /** Titre du dialog mobile (ex. "Heure de début") — court, même registre que les autres dialogs (Titre, Notes, Prix) ; retombe sur un libellé générique selon `mode` si non fourni, voir TimePickerClockComponent. */
    readonly label = input<string>('');
    /** Heure minimum (voir ROADMAP.md "UX / Interactions") : n'a de sens que si début/fin tombent le MÊME jour (comparaison en heure seule, `applySelectedDate` ignore la partie date) — laisser à `null` sinon. Toute saisie antérieure est remontée à cette valeur plutôt que rejetée silencieusement. */
    readonly minTime = input<Date | null>(null);
    /** Voir `TimePickerClockData.dayOffsetReference` — active le sélecteur "J+N" dans le dialog mobile (uniquement le picker "Heure de fin" d'une activité, voir ROADMAP.md "UX / Interactions"). */
    readonly dayOffsetReference = input<Date | null>(null);
    /** Valeur courante de l'offset — n'a d'effet que si `dayOffsetReference` est fourni. */
    readonly dayOffset = input(0);
    /** Émis à la fermeture du dialog (OK uniquement, jamais Annuler) si `dayOffsetReference` est fourni et que l'offset a été manipulé via les flèches "J+N". */
    readonly dayOffsetChange = output<number>();

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
        // Boîte mutable partagée avec TimePickerClockComponent (voir la doc de
        // TimePickerClockData.dayOffset) : `undefined` pour tous les pickers
        // qui ne fournissent pas `dayOffsetReference`, donc aucun coût/risque
        // pour eux (le sélecteur "J+N" n'est même pas rendu côté clock).
        const dayOffsetBox = this.dayOffsetReference() ? { value: this.dayOffset() } : undefined;

        const dialogRef = this.dialogService.open<Date | undefined, TimePickerClockData>(TimePickerClockComponent, {
            data: {
                initialDate: this.currentDate(), mode: this.mode(), label: this.label(),
                dayOffsetReference: this.dayOffsetReference(), dayOffset: dayOffsetBox,
            },
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
            // Même sémantique que la date : un "Annuler" n'écrase rien, y
            // compris l'offset manipulé pendant que le dialog était ouvert.
            if (dayOffsetBox) this.dayOffsetChange.emit(dayOffsetBox.value);
            this.closed.emit(this.applySelectedDate(selected));
        });
    }

    onHourFieldChange(value: string): void {
        const current = this.currentDate();
        const date = current ? new Date(current) : this.blankDate();
        date.setHours(Number(value) || 0, date.getMinutes(), 0, 0);
        this.applySelectedDate(date);
    }

    onMinuteFieldChange(value: string): void {
        const current = this.currentDate();
        const date = current ? new Date(current) : this.blankDate();
        date.setMinutes(Number(value) || 0, 0, 0);
        this.applySelectedDate(date);
    }

    /**
     * Base neutre (00:00) pour une saisie clavier partant de rien — jamais
     * `new Date()` telle quelle : sinon saisir seulement l'heure (champ minute
     * pas encore touché) fait hériter les minutes de l'INSTANT de la frappe,
     * pas d'une valeur neutre (même piège que le drag and drop, voir
     * ROADMAP.md "Lorsque je drag and drop les activités...").
     */
    private blankDate(): Date {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        return date;
    }

    private applySelectedDate(rawDate: Date): Date {
        const date = this.clampToMinTime(rawDate);
        const hour = String(date.getHours()).padStart(2, '0');
        const minute = String(date.getMinutes()).padStart(2, '0');
        this.currentDate.set(date);
        this.hourText.set(hour);
        this.minuteText.set(minute);
        this.displayText.set(`${hour}:${minute}`);
        this.onChange?.(date);
        this.onTouch?.();
        return date;
    }

    /** Voir la doc de `minTime` — ne compare que l'heure/minute, ignore la partie date des deux côtés (le champ ne connaît que l'heure du jour, pas quel jour). */
    private clampToMinTime(date: Date): Date {
        const min = this.minTime();
        if (!min) return date;
        const dateMinutes = date.getHours() * 60 + date.getMinutes();
        const minMinutes = min.getHours() * 60 + min.getMinutes();
        if (dateMinutes >= minMinutes) return date;

        const clamped = new Date(date);
        clamped.setHours(min.getHours(), min.getMinutes(), 0, 0);
        return clamped;
    }
}
