import { DestroyRef } from '@angular/core';

/**
 * Adapte un flux CDK (`output()`/`Observable`, ex. `DialogRef.closed`, `DatePickerComponent.selected`)
 * en `Promise` pour permettre le chaînage `async`/`await` d'une cinématique guidée (voir
 * `NewTripComponent`/`LogisticDetailsComponent`/`MultiCityFieldComponent`/`TripSettingsSectionComponent`).
 * Se désabonne automatiquement à la destruction du composant (`DestroyRef`) pour ne pas laisser une
 * souscription active si le composant est détruit avant que la source n'émette. Si la source
 * n'émet jamais (ex. annulation sans signal dédié), la promesse reste simplement en attente — le
 * chaînage s'arrête là, sans erreur.
 */
export function awaitOnce<T>(
  source: { subscribe(next: (value: T) => void): { unsubscribe(): void } },
  destroyRef: DestroyRef,
): Promise<T> {
  return new Promise((resolve) => {
    const subscription = source.subscribe((value) => {
      subscription.unsubscribe();
      resolve(value);
    });
    destroyRef.onDestroy(() => subscription.unsubscribe());
  });
}
