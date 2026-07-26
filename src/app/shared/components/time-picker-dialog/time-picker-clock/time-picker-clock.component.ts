import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, ViewChild, effect, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ButtonComponent } from '@app/shared/components/button/button.component';
import { DialogFrameComponent } from '@app/shared/components/dialog-frame/dialog-frame.component';
import { TimeFieldsComponent } from '@app/shared/components/time-picker-dialog/time-fields/time-fields.component';

interface ClockItem {
    label: string;
    value: number;
    x: string;
    y: string;
    inner?: boolean;
}

/** 'duration' : une durée n'est pas une heure sur un cadran 24h, la saisie clavier est donc affichée directement sans bascule possible vers le cadran. */
export type TimePickerMode = 'time' | 'duration';

export interface TimePickerClockData {
    initialDate: Date | null;
    mode: TimePickerMode;
    /** Titre du dialog — si vide, retombe sur un libellé générique selon `mode` (voir `TimePickerClockComponent.header`). */
    label: string;
}

/**
 * Contenu ouvert par `TimePickerDialogComponent` via `DialogService` (Phase
 * 7c de la sortie de PrimeNG, voir PRIMENG_MIGRATION.md) — reprend telle
 * quelle la logique de sélection d'heure (cadran, drag) qui vivait avant
 * directement dans le `<p-dialog>` embarqué de `TimePickerDialogComponent`.
 * Séparée en composant à part car `DialogService.open()` instancie
 * dynamiquement un composant indépendant (pas un `<ng-template>` local) :
 * `TimePickerDialogComponent` garde le déclencheur + le
 * `ControlValueAccessor`, celui-ci ne connaît que la date initiale reçue via
 * `DIALOG_DATA` et referme le dialog avec la date choisie via `DialogRef.close(date)`.
 */
@Component({
    selector: 'app-time-picker-clock',
    standalone: true,
    imports: [CommonModule, ButtonComponent, DialogFrameComponent, TimeFieldsComponent],
    templateUrl: './time-picker-clock.component.html',
    styleUrl: './time-picker-clock.component.scss',
})
export class TimePickerClockComponent implements AfterViewInit {

    private readonly dialogRef = inject(DialogRef<Date | undefined>);
    private readonly data = inject<TimePickerClockData>(DIALOG_DATA);
    private readonly cdr = inject(ChangeDetectorRef);

    @ViewChild('clockFace')
    clockFace!: ElementRef<HTMLDivElement>;

    private readonly timeFields = viewChild<TimeFieldsComponent>('timeFields');

    /** 'duration' : pas de cadran, saisie clavier uniquement (voir TimePickerMode). */
    readonly isDurationMode = this.data.mode === 'duration';

    /** Libellé fourni par l'appelant (`TimePickerDialogComponent.label`), sinon générique selon le mode. */
    readonly header = this.data.label || (this.isDurationMode ? 'Sélectionner une durée' : 'Sélectionner une heure');

    /** Durée : toujours clavier. Heure : cadran par défaut, bascule possible via le bouton clavier. */
    viewMode = signal<'clock' | 'keyboard'>(this.isDurationMode ? 'keyboard' : 'clock');

    isDragging = false;

    private hasValidated = false;

    /**
     * Un seul geste (pointerdown → pointerup, ou activation clavier) ne doit
     * produire qu'UNE seule action (avancer hour→minute, ou valider). Sur la
     * plupart des navigateurs/appareils, `pointerup` (via `stopDrag`) ET le
     * `click` de compatibilité qui suit (via `selectValue`) se déclenchent
     * tous les deux pour un même tap sur un `<button class="clock-number">` —
     * sans ce verrou, `stopDrag` fait déjà avancer `selectionMode` vers
     * 'minute', puis `selectValue` (déclenché ensuite par le `click`)
     * réinterprète la valeur d'heure tapée comme une minute et valide
     * aussitôt : le dialog se refermait au lieu de passer à la sélection des
     * minutes. Réinitialisé à chaque nouveau geste dans `startDrag`.
     */
    private gestureHandled = false;

    tempHour: string;
    tempMinute: string;

    selectionMode: 'hour' | 'minute' = 'hour';

    // Taille réelle du cadran (`.clock-face`, 16.5rem en CSS) : lue une seule
    // fois dans `ngAfterViewInit` (pas dans les getters positionnels
    // ci-dessous). Avant ce correctif, `getClockSize()` retombait sur un
    // FALLBACK figé (280) tant que `@ViewChild` n'était pas encore résolu —
    // donc pour TOUT le premier rendu (chiffres du cadran, aiguille,
    // sélecteur), puisque ces getters sont évalués dans le template avant
    // `ngAfterViewInit`. 280px ne correspond pas à 16.5rem (264px à 16px
    // racine, 247.5px sur mobile où `reset.scss` passe le root à 15px) :
    // d'où les chiffres visiblement mal positionnés jusqu'au premier
    // changement détecté par Angular (n'importe quel événement, y compris un
    // simple survol souris, qui réévalue alors les getters avec la vraie
    // taille mesurée).
    private readonly clockSize = signal(280);

    constructor() {
        const initial = this.data.initialDate;
        if (initial instanceof Date) {
            this.tempHour = String(initial.getHours()).padStart(2, '0');
            this.tempMinute = String(initial.getMinutes()).padStart(2, '0');
        } else {
            const now = new Date();
            this.tempHour = String(now.getHours()).padStart(2, '0');
            this.tempMinute = String(now.getMinutes()).padStart(2, '0');
        }

        effect(() => {
            if (this.viewMode() === 'keyboard') {
                this.timeFields()?.focusHour();
            }
        });
    }

    // Correction synchrone, DANS LA MÊME passe de détection de changements
    // que celle qui a déclenché ce hook (`ChangeDetectorRef.detectChanges()`
    // ici, pas un `afterNextRender`/microtâche séparé) : une tentative
    // précédente avec `afterNextRender` introduisait un second cycle de CD
    // réellement asynchrone, qui perturbait l'autofocus CDK du dialog
    // (bouton "OK" perdant sa couleur primary, croix de fermeture affichée
    // comme pré-sélectionnée, scintillement des boutons à l'ouverture).
    // `ngAfterViewInit` + `detectChanges()` reste dans le flux synchrone
    // déjà en cours, sans nouvelle tâche planifiée.
    ngAfterViewInit(): void {
        // En mode durée (`isDurationMode`), le cadran n'est jamais monté au
        // démarrage (`viewMode` vaut 'keyboard' d'entrée) : `clockFace` reste
        // alors `undefined`.
        if (this.clockFace) {
            this.clockSize.set(this.clockFace.nativeElement.clientWidth);
            this.cdr.detectChanges();
        }
    }

    close(): void {
        this.dialogRef.close(undefined);
    }

    validate(): void {

        // Idempotent : sur mobile, un tap discret sur une minute déclenche déjà
        // la validation via `stopDrag` (pointerup) — l'événement `click` de
        // secours (nécessaire à l'activation clavier Entrée/Espace, qui ne
        // déclenche aucun événement pointeur) rappellerait sinon `validate()`
        // une 2e fois sur un dialog déjà en train de se fermer.
        if (this.hasValidated) {
            return;
        }
        this.hasValidated = true;

        const updatedDate =
            this.data.initialDate
                ? new Date(this.data.initialDate)
                : new Date();

        updatedDate.setHours(
            Number(this.tempHour),
            Number(this.tempMinute),
            0,
            0
        );

        this.dialogRef.close(updatedDate);
    }

    /** Bascule vers la saisie clavier (bouton clavier, coin bas gauche) — indisponible en mode durée, déjà affiché d'entrée. */
    switchToKeyboard(): void {
        this.viewMode.set('keyboard');
    }

    /** Retour au cadran (bouton horloge, coin bas gauche, uniquement visible en mode clavier hors durée). */
    switchToClock(): void {
        this.viewMode.set('clock');
        // Même logique synchrone que `ngAfterViewInit` (voir commentaire sur
        // `clockSize`) : `clockFace` ne se résout qu'après ce `detectChanges`
        // puisque le cadran vient tout juste de réapparaître dans le DOM.
        this.cdr.detectChanges();
        if (this.clockFace) {
            this.clockSize.set(this.clockFace.nativeElement.clientWidth);
        }
    }

    onKeyboardHourChange(value: string): void {
        this.tempHour = value || '0';
    }

    onKeyboardMinuteChange(value: string): void {
        this.tempMinute = value || '0';
    }

    /**
     * Sur souris/tactile, `stopDrag` (pointerup) a déjà traité le geste avant
     * que ce `click` de compatibilité ne se déclenche (voir `gestureHandled`) :
     * ce handler ne produit alors plus aucun effet. Il ne reste réellement
     * actif que pour l'activation clavier (Entrée/Espace sur un bouton
     * focalisé), qui ne passe par aucun événement pointeur.
     */
    selectValue(
        value: string
    ): void {

        if (this.gestureHandled) {
            return;
        }

        if (this.selectionMode === 'hour') {

            this.tempHour =
                value.padStart(2, '0');

            if (!this.isDragging) {
                this.gestureHandled = true;
                this.selectionMode = 'minute';
            }

        } else {

            this.tempMinute =
                value.padStart(2, '0');

            if (!this.isDragging) {
                this.gestureHandled = true;
                this.validate();
            }
        }
    }

    startDrag(
        event: PointerEvent
    ): void {

        this.isDragging = true;
        this.gestureHandled = false;

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

    /**
     * `commit` distingue un relâchement normal (pointerup, valide la
     * sélection en cours) d'une sortie de zone/annulation par le système
     * (pointercancel/pointerleave) qui ne doit rien déclencher.
     *
     * `.clock-face` appelle `setPointerCapture` sur elle-même dès le
     * `pointerdown` (voir `startDrag`), y compris quand celui-ci démarre sur
     * un `<button class="clock-number">` enfant. Selon le navigateur, ça peut
     * retargeter le `click` de compatibilité qui suit vers l'élément
     * capturant (`.clock-face`, pas le bouton) — mais ce n'est pas garanti
     * partout : sur certains navigateurs/appareils, le `click` atteint bien
     * le bouton normalement en plus de ce `pointerup`. D'où le verrou
     * `gestureHandled` : c'est CE handler (pointerup, toujours fiable) qui
     * avance hour → minute et valide minute → OK, et il empêche `selectValue`
     * (click) de rejouer la même action une 2e fois avec un `selectionMode`
     * déjà modifié entre-temps.
     */
    stopDrag(commit: boolean): void {

        const wasDragging = this.isDragging;
        this.isDragging = false;

        if (!commit || !wasDragging || this.gestureHandled) {
            return;
        }
        this.gestureHandled = true;

        if (this.selectionMode === 'hour') {
            this.selectionMode = 'minute';
        } else {
            this.validate();
        }
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

        return this.clockSize();
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
