/**
 * Error classification only. Browser recovery itself is deliberately bounded.
 * A closed persistent Chromium context requires a new context, not a new page.
 */
export function isBrowserClosedError(error) {
  const message = String(error?.message || error || '');
  return /Target page, context or browser has been closed|TargetClosedError|Browser has been closed|Browser closed|browserContext\.newPage:.*closed/i.test(message);
}
