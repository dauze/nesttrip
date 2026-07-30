import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Logistic } from '@core/models/logistic.dto';
import { LOGISTIC_TYPE_META } from '../../logistic.constants';
import { runOnceReady } from '@app/shared/utils/run-once-ready';

/**
 * Header d'une carte réservation : icône du type + titre éditable en texte
 * libre — PAS une recherche Google (contrairement au titre d'activité) : une
 * réservation a déjà son ou ses champs "adresse" dédiés par type (hôtel/
 * aéroports/agences, voir `LogisticDetailsComponent`), le titre n'est
 * qu'un intitulé libre ("Logement Ibis Paris 12", "Vol retour"...). Simple
 * `<input>` natif, identique mobile/desktop — voir le scss pour le style
 * "texte" au repos qui ne redevient visuellement un champ qu'au focus.
 */
@Component({
  selector: 'app-logistic-header',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './logistic-header.component.html',
  styleUrl: './logistic-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogisticHeaderComponent {
  readonly logistic = input.required<Logistic>();
  readonly titleEdited = output<string>();

  readonly typeMeta = LOGISTIC_TYPE_META;

  /**
   * Valeur locale découplée du signal `logistic` après l'initialisation
   * (voir `runOnceReady`) : un snapshot distant reçu pendant la frappe ne
   * doit jamais écraser une saisie en cours (même garde-fou que
   * `ActivityHeaderComponent.titleControl`).
   */
  readonly titleValue = signal('');

  constructor() {
    runOnceReady(this.logistic, (r) => this.titleValue.set(r.title));
  }

  onTitleInput(value: string): void {
    this.titleValue.set(value);
  }

  onTitleBlur(): void {
    const trimmed = this.titleValue().trim();
    if (this.logistic().title === trimmed) return;
    this.titleEdited.emit(trimmed);
  }

  /**
   * Laisse le clavier virtuel finir son animation d'ouverture avant de
   * scroller (sinon le calcul de position utilise encore la hauteur de
   * viewport d'avant clavier et le champ reste caché dessous) — même délai
   * que `PANEL_COLLAPSE_DELAY_MS` ailleurs dans le projet pour la même
   * raison (attendre la fin d'une animation avant de mesurer/agir).
   */
  onTitleFocus(event: FocusEvent): void {
    const target = event.target as HTMLElement;
    setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
  }
}
