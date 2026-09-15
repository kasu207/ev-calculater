import { expect, test } from '@playwright/test';

/**
 * Die oeffentlichen Seiten sind der einzige Weg, auf dem jemand den Rechner
 * findet, der ihn noch nicht kennt. Deshalb pruefen diese Tests nicht die
 * Optik, sondern genau die Eigenschaften, ohne die sie ihren Zweck verfehlen:
 * lesbar ohne JavaScript, indexierbar, untereinander verlinkt, und mit einer
 * Ertragsmoeglichkeit versehen.
 */

type Ereignis = { name: string; daten?: Record<string, unknown> };

async function ereignisseSammeln(seite: import('@playwright/test').Page) {
  await seite.addInitScript(() => {
    const gesammelt: Ereignis[] = [];
    (window as unknown as { __ereignisse: Ereignis[] }).__ereignisse = gesammelt;
    (window as unknown as { umami: unknown }).umami = {
      track: (name: string, daten?: Record<string, unknown>) => gesammelt.push({ name, daten }),
    };
  });
}

test('Modellseite steht vollständig ohne JavaScript', async ({ browser }) => {
  const kontext = await browser.newContext({ javaScriptEnabled: false });
  const seite = await kontext.newPage();
  await seite.goto('/e-auto/vw-id3');

  await expect(seite.getByRole('heading', { level: 1 })).toContainText('Volkswagen ID.3');
  // Die Tabelle ueber alle Fahrleistungen ist der Grund, warum es diese Seite gibt.
  await expect(seite.getByRole('cell', { name: '30.000 km' })).toBeVisible();
  await expect(seite.getByRole('link', { name: /Preise für den .* anfragen/ })).toBeVisible();
  await kontext.close();
});

test('Fahrleistungsseite steht vollständig ohne JavaScript', async ({ browser }) => {
  const kontext = await browser.newContext({ javaScriptEnabled: false });
  const seite = await kontext.newPage();
  await seite.goto('/fahrleistung/30000-km');

  await expect(seite.getByRole('heading', { level: 1 })).toContainText('30.000 km');
  // Alle Modelle stehen in der Rangliste, nicht nur die Empfehlung.
  await expect(seite.getByRole('link', { name: 'Volkswagen ID.3' })).toBeVisible();
  await kontext.close();
});

test('öffentliche Seiten zeigen den Canonical auf sich selbst', async ({ page }) => {
  // Der Rechner kanonisiert bewusst auf '/', weil seine Parameter beliebig
  // kombinierbar sind. Bei diesen Seiten waere dasselbe Verhalten fatal: sie
  // wuerden aus dem Index fallen und damit nutzlos.
  await page.goto('/e-auto/vw-id3');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    /\/e-auto\/vw-id3$/,
  );

  await page.goto('/fahrleistung/30000-km');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    /\/fahrleistung\/30000-km$/,
  );

  await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
});

test('unbekannte Adressen liefern 404 statt einer leeren Seite', async ({ page }) => {
  expect((await page.goto('/e-auto/gibt-es-nicht'))?.status()).toBe(404);
  // Nur die ausgelieferten Fahrleistungen haben eine Seite, sonst waeren es
  // beliebig viele fast gleiche Adressen.
  expect((await page.goto('/fahrleistung/7777-km'))?.status()).toBe(404);
});

test('Sitemap führt alle öffentlichen Seiten', async ({ request }) => {
  const antwort = await request.get('/sitemap.xml');
  expect(antwort.status()).toBe(200);
  const xml = await antwort.text();

  expect(xml).toContain('/e-auto/vw-id3');
  expect(xml).toContain('/fahrleistung/30000-km');
  expect(xml).toContain('/e-auto<');

  // Der Rechner mit Parametern gehoert nicht hinein - das waeren beliebig
  // viele Adressen mit demselben Inhalt.
  expect(xml).not.toContain('?km=');
  expect(xml).not.toContain('/rechner');
});

test('Seiten sind untereinander erreichbar', async ({ page }) => {
  await page.goto('/e-auto');
  await page.getByRole('link', { name: 'Volkswagen ID.3' }).first().click();
  await expect(page).toHaveURL(/\/e-auto\/vw-id3$/);

  // Von der Modellseite in die Fahrleistung und zurueck in die Uebersicht.
  await page.getByRole('cell', { name: '30.000 km' }).getByRole('link').click();
  await expect(page).toHaveURL(/\/fahrleistung\/30000-km$/);

  await page.getByRole('navigation', { name: 'Brotkrumen' }).getByRole('link', { name: 'Modelle' }).click();
  await expect(page).toHaveURL(/\/e-auto$/);
});

test('Partnerlink der Modellseite ist ausgezeichnet, offengelegt und als solcher gemessen', async ({
  page,
}) => {
  await ereignisseSammeln(page);
  await page.goto('/e-auto/vw-id3');

  const cta = page.getByRole('link', { name: /Preise für den .* anfragen/ });
  await expect(cta).toHaveAttribute('rel', 'sponsored noopener');
  await expect(page.getByText(/zahlt Carwow uns 10 €/)).toBeVisible();

  // Ohne die Seitenart im Ereignis liesse sich nicht beantworten, ob diese
  // Seiten Anfragen bringen oder nur Aufrufe.
  await cta.click({ modifiers: ['Alt'] });
  const gesammelt: Ereignis[] = await page.evaluate(
    () => (window as unknown as { __ereignisse: Ereignis[] }).__ereignisse,
  );
  const klick = gesammelt.find((e) => e.name === 'offer_cta_clicked');
  expect(klick?.daten?.seitenart).toBe('modell');
  expect(klick?.daten?.modellId).toBe('vw-id3');
});

test('Rechner meldet weiterhin seine eigene Seitenart', async ({ page }) => {
  await ereignisseSammeln(page);
  await page.goto('/');
  await page.getByRole('link', { name: /bei Carwow ansehen$/ }).click({ modifiers: ['Alt'] });

  const gesammelt: Ereignis[] = await page.evaluate(
    () => (window as unknown as { __ereignisse: Ereignis[] }).__ereignisse,
  );
  expect(gesammelt.find((e) => e.name === 'offer_cta_clicked')?.daten?.seitenart).toBe('rechner');
});
