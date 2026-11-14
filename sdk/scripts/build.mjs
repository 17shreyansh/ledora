/* global process, URL */
// Builds dist/v1/widget.js (+ immutable content-hashed copy) and dist/v1/manifest.json.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';

const root = new URL('..', import.meta.url);
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
const major = pkg.version.split('.')[0];
const outDir = new URL(`dist/v${major}/`, root);
const GZIP_BUDGET = 8 * 1024;

const result = await build({
  entryPoints: [new URL('src/widget.ts', root).pathname],
  bundle: true,
  minify: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2018'],
  define: { __LEDORA_VERSION__: JSON.stringify(pkg.version) },
  legalComments: 'none',
  write: false,
  metafile: true,
});

const code = result.outputFiles[0].contents;
const inputs = Object.keys(result.metafile.inputs);
const forbidden = inputs.filter((f) => /zod|packages\/shared\/src\/(index|schemas)/.test(f));
if (forbidden.length) throw new Error(`Bundle must not include: ${forbidden.join(', ')}`);

const sha384 = 'sha384-' + createHash('sha384').update(code).digest('base64');
const hash8 = createHash('sha256').update(code).digest('hex').slice(0, 8);
const file = `widget.${hash8}.js`;
const gzipBytes = gzipSync(code, { level: 9 }).length;

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
writeFileSync(new URL('widget.js', outDir), code);
writeFileSync(new URL(file, outDir), code);
const manifest = { version: pkg.version, file, sha384, bytes: code.length, gzipBytes };
writeFileSync(new URL('manifest.json', outDir), JSON.stringify(manifest, null, 2) + '\n');

process.stdout.write(
  `@ledora/sdk ${pkg.version}: dist/v${major}/widget.js and ${file}\n` +
    `  ${code.length} bytes, ${gzipBytes} bytes gzipped (budget ${GZIP_BUDGET}), ${sha384}\n` +
    `  bundled inputs: ${inputs.join(', ')}\n`,
);
if (gzipBytes > GZIP_BUDGET) {
  process.stderr.write(`Size budget exceeded: ${gzipBytes} > ${GZIP_BUDGET} bytes gzipped\n`);
  process.exit(1);
}
