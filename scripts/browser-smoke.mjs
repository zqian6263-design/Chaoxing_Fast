import '../src/runtime.mjs';
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto('data:text/html,<title>smoke</title><h1>Chromium ready</h1>');
  const title = await page.title();
  const content = await page.locator('h1').textContent();
  if (title !== 'smoke' || content !== 'Chromium ready') throw new Error('Browser smoke mismatch');
  console.log('Browser smoke PASS: Playwright controlled real Chromium headlessly');
  await page.close();
} finally {
  await browser.close();
}
