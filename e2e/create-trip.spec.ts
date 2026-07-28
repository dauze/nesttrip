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

test('création d’un voyage (titre, ville en texte libre, dates au clavier) mène au trip créé', async ({ authenticatedPage: page }) => {
  await page.goto('/trips/new');

  const tripTitle = `E2E Test Trip ${Date.now()}`;
  await page.locator('#title').fill(tripTitle);

  // Texte libre : le contrôle "ville" est validé dès la frappe (voir
  // AutoCompleteComponent.onInput), pas besoin de choisir une suggestion
  // Google Places — ça évite de dépendre du réseau Places dans ce test.
  await page.locator('app-autocomplete input').fill('Reykjavik');

  // Saisie clavier desktop de la plage de dates (dd/MM/yyyy - dd/MM/yyyy),
  // voir ROADMAP.md "Saisie clavier des dates dans app-date-picker".
  const start = daysFromNow(30);
  const end = daysFromNow(35);
  const datesInput = page.locator('#dates');
  await datesInput.fill(`${formatFr(start)} - ${formatFr(end)}`);
  await datesInput.press('Enter');

  await page.getByRole('button', { name: 'Créer le voyage' }).click();

  await expect(page).toHaveURL(/\/trips\/[0-9a-f-]{36}$/, { timeout: 15_000 });
});
