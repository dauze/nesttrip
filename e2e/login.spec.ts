import { test, expect, loginViaUi } from './fixtures/auth';

test('connexion par email redirige vers l’espace voyages', async ({ page }) => {
  await loginViaUi(page);

  // Un seul trip sur le compte -> redirection auto vers /trips/:id (AccueilTripComponent) ;
  // sinon la liste "Mes voyages" reste affichée sur /trips.
  const redirectedToSingleTrip = /\/trips\/[^/]+$/.test(page.url());
  if (!redirectedToSingleTrip) {
    await expect(page.getByText('Mes voyages')).toBeVisible();
  }
});
