/**
 * Coarse user-agent classification. Only these three labels are stored; the raw
 * user-agent string is never persisted (it is a fingerprinting vector).
 */
export interface DeviceInfo {
  type: 'desktop' | 'mobile' | 'tablet' | 'other';
  browser: string;
  os: string;
}

const BOT = /bot|crawl|spider|slurp|headless|phantomjs|lighthouse|pingdom|uptime|monitor|curl|wget|python-requests|axios|node-fetch|go-http-client|java\//i;

export function isBotUserAgent(ua: string | undefined): boolean {
  return !ua || ua.length < 10 || BOT.test(ua);
}

export function classifyUserAgent(ua: string): DeviceInfo {
  const os = /windows/i.test(ua)
    ? 'Windows'
    : /iphone|ipad|ipod/i.test(ua)
      ? 'iOS'
      : /android/i.test(ua)
        ? 'Android'
        : /cros/i.test(ua)
          ? 'ChromeOS'
          : /mac os x|macintosh/i.test(ua)
            ? 'macOS'
            : /linux/i.test(ua)
              ? 'Linux'
              : 'Other';
  const browser = /edg\//i.test(ua)
    ? 'Edge'
    : /opr\/|opera/i.test(ua)
      ? 'Opera'
      : /samsungbrowser/i.test(ua)
        ? 'Samsung Internet'
        : /firefox|fxios/i.test(ua)
          ? 'Firefox'
          : /chrome|crios/i.test(ua)
            ? 'Chrome'
            : /safari/i.test(ua)
              ? 'Safari'
              : 'Other';
  const type = /ipad|tablet|(android(?!.*mobile))/i.test(ua) ? 'tablet' : /mobi|iphone|ipod/i.test(ua) ? 'mobile' : os === 'Other' ? 'other' : 'desktop';
  return { type, browser, os };
}
