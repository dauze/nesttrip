import { test, expect } from './fixtures/auth';

function formatFr(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${date.getFullYear()}`;
}

function daysFromNow(n: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + n);
  return date;
}

/**
 * Reproduit ROADMAP.md "Bugs / fixes" : modifier l'intervalle de dates
 * depuis l'onglet Résumé affichait le skeleton de chargement (jusqu'à 4s,
 * voir `TripDetailComponent.contentReady`) et pouvait laisser l'ancien
 * intervalle affiché une fois celui-ci reparti — alors que le jour swiper,
 * lui, reflétait déjà correctement les nouveaux jours. Cause : l'effect qui
 * réinitialise `contentReady` (donc affiche le skeleton) se redéclenchait
 * pour TOUT changement de référence de `activeTrip()`, y compris pour le
 * MÊME trip quand un jour est ajouté/supprimé — pas seulement lors d'une
 * vraie navigation vers un autre trip.
 */
test("modifier l'intervalle de dates depuis Résumé ne doit jamais afficher le skeleton, et les nouvelles dates doivent s'afficher", async ({ authenticatedPage: page }) => {
  await page.goto('/trips/new');

  const tripTitle = `E2E Date Range Trip ${Date.now()}`;
  await page.locator('#title').fill(tripTitle);
  await page.locator('app-autocomplete input').fill('Reykjavik');

  const start = daysFromNow(30);
  const initialEnd = daysFromNow(35);
  const datesInput = page.locator('#dates');
  await datesInput.fill(`${formatFr(start)} - ${formatFr(initialEnd)}`);
  await datesInput.press('Enter');

  await page.getByRole('button', { name: 'Créer le voyage' }).click();
  await expect(page).toHaveURL(/\/trips\/[0-9a-f-]{36}(#.*)?$/, { timeout: 15_000 });

  await page.locator('button[data-tab-id="summary"]').click();

  const dateLabel = page.locator('app-trip-header').getByText(/^Date : /);
  await expect(dateLabel).toHaveText(`Date : ${formatFr(start)} - ${formatFr(initialEnd)}`);

  await page.getByRole('button', { name: 'Modifier les dates' }).click();

  const newEnd = daysFromNow(37);
  await datesInput.fill(`${formatFr(start)} - ${formatFr(newEnd)}`);
  await datesInput.press('Enter');

  const skeleton = page.locator('.skeleton-overlay');

  // Poll sur ~2s (le filet de sécurité de contentReady vaut 4s) : le
  // skeleton ne doit à AUCUN moment devenir visible suite à cette édition.
  for (let i = 0; i < 8; i++) {
    await expect(skeleton).toHaveCount(0);
    await page.waitForTimeout(250);
  }

  await expect(dateLabel).toHaveText(`Date : ${formatFr(start)} - ${formatFr(newEnd)}`, { timeout: 5_000 });
});
