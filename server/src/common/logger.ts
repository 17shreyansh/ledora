import { AsyncLocalStorage } from 'node:async_hooks';
import { pino, type Logger } from 'pino';

export interface RequestStore {
  requestId: string;
}

export const requestStore = new AsyncLocalStorage<RequestStore>();

/** Paths never written to logs. */
const REDACT = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-csrf-token"]',
  'res.headers["set-cookie"]',
  '*.password',
  '*.currentPassword',
  '*.newPassword',
  '*.token',
  '*.passwordHash',
  '*.tokenHash',
];

export function createLogger(level: string, pretty = false): Logger {
  return pino({
    level,
    base: { service: 'ledora-api' },
    redact: { paths: REDACT, censor: '[redacted]' },
    timestamp: pino.stdTimeFunctions.isoTime,
    mixin() {
      const store = requestStore.getStore();
      return store ? { requestId: store.requestId } : {};
    },
    ...(pretty ? { transport: { target: 'pino-pretty', options: { singleLine: true } } } : {}),
  });
}

/** Process-wide logger; replaced at boot with the configured level. */
export let logger: Logger = createLogger(process.env.LOG_LEVEL ?? 'info');

export function setLogger(next: Logger): void {
  logger = next;
}
