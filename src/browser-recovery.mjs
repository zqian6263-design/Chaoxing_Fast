/**
 * Error classification only. Browser recovery itself is deliberately bounded.
 * A closed persistent Chromium context requires a new context, not a new page.
 */
/**
 * Choose an existing tab instead of opening a new tab for each video.
 * The same page object is used across lesson navigations.
 */
export async function getPlaybackPage(context, previous = null) {
  if (previous && !previous.isClosed()) return previous;
  const existing = context.pages().find((tab) => !tab.isClosed());
  return existing || await context.newPage();
}

export function isBrowserClosedError(error) {
  const message = String(error?.message || error || '');
  return /Target page, context or browser has been closed|TargetClosedError|Browser has been closed|Browser closed|browserContext\.newPage:.*closed/i.test(message);
}
