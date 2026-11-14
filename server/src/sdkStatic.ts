import express, { type RequestHandler } from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Serves the built SDK as the CDN *origin* (Cloudflare caches in front of it).
 * Content-hashed files are immutable; the unhashed loader URL is cached briefly so
 * a release or rollback propagates within minutes (Part 32.12).
 */
export function sdkStatic(configured: string | undefined): RequestHandler | null {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const dir = configured ?? path.resolve(here, '../../sdk/dist');
  if (!existsSync(dir)) return null;
  return express.static(dir, {
    index: false,
    dotfiles: 'deny',
    fallthrough: true,
    setHeaders(res, filePath) {
      const hashed = /\.[a-f0-9]{8}\.js$/.test(filePath);
      res.setHeader('Cache-Control', hashed ? 'public, max-age=31536000, immutable' : 'public, max-age=300');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  });
}
