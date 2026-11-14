const HEADLESS_RE = /headlesschrome|phantomjs|\bbot\b|bot[/;]|crawler|spider/i;

/** Obvious headless browsers and crawlers: skip tracking entirely. */
export function isBotUserAgent(ua: string): boolean {
  return HEADLESS_RE.test(ua);
}

/** WebDriver-controlled browser (Playwright, Selenium …): tracked, but flagged as automated. */
export function isAutomated(): boolean {
  try {
    return navigator.webdriver === true;
  } catch {
    return false;
  }
}

/** Do Not Track or Global Privacy Control. */
export function privacySignal(): boolean {
  try {
    const n = navigator as Navigator & { globalPrivacyControl?: boolean };
    return n.doNotTrack === '1' || n.globalPrivacyControl === true;
  } catch {
    return false;
  }
}
