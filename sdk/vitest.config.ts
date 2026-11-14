import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  define: { __LEDORA_VERSION__: JSON.stringify(pkg.version) },
  test: {
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'https://shop.example.com/' } },
    include: ['test/**/*.test.ts'],
  },
});
