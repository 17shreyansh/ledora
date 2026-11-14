/** Where the browser SDK is served from. Configure with `VITE_SDK_URL`. */
export const SDK_URL: string = import.meta.env.VITE_SDK_URL || 'http://localhost:4000/sdk/v1/widget.js';

/**
 * Public API origin the SDK should send events to, when it differs from the SDK's own origin.
 * Configure with `VITE_PUBLIC_API_URL`; when unset, the snippet leaves the attribute out.
 */
export const PUBLIC_API_URL: string | undefined = import.meta.env.VITE_PUBLIC_API_URL || undefined;

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** The exact markup a customer pastes into their site's `<head>`. */
export function buildInstallSnippet(
  siteKey: string,
  { sdkUrl = SDK_URL, apiUrl = PUBLIC_API_URL }: { sdkUrl?: string; apiUrl?: string | undefined } = {},
): string {
  const api = apiUrl ? ` data-ledora-api="${escapeAttribute(apiUrl)}"` : '';
  return `<script src="${escapeAttribute(sdkUrl)}" data-ledora-site="${escapeAttribute(siteKey)}"${api} async></script>`;
}
