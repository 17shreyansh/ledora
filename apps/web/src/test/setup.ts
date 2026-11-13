import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { setCsrfToken } from '../api/client';

// jsdom has no matchMedia; MUI's useMediaQuery needs it. Report a desktop-sized screen.
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: /min-width:\s*(\d+)/.test(query) ? Number(/min-width:\s*(\d+)/.exec(query)?.[1]) <= 1280 : false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

afterEach(() => {
  cleanup();
  setCsrfToken(null);
  sessionStorage.clear();
  vi.unstubAllGlobals();
});
