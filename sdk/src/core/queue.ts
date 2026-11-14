import { INGEST_LIMITS } from './contract';
import type { IngestBatch, IngestEvent } from './contract';
import { backoff, beacon, byteLength, parseRetryAfter, post } from './transport';
import { later, now } from './util';
import type { Timer } from './util';

export const QUEUE_CAP = 200;
export const MAX_ATTEMPTS = 5;

export interface QueueOptions {
  endpoint: string;
  maxBatchSize: number;
  flushIntervalMs: number;
  header: () => Omit<IngestBatch, 'events'>;
}

export interface Queue {
  push(event: IngestEvent): void;
  flush(): void;
  /** Page is being hidden/unloaded: hand everything queued to sendBeacon. */
  flushBeacon(): void;
  /** Drop queued events and pending retries (consent withdrawn). */
  clear(): void;
  /** Stop for this page load (403) — also used on teardown. */
  stop(): void;
  readonly stopped: boolean;
}

interface Job {
  events: IngestEvent[];
  attempts: number;
  split: boolean;
}

export function createQueue(o: QueueOptions): Queue {
  let queue: IngestEvent[] = [];
  let flushTimer: Timer | undefined;
  let stopped = false;
  let pausedUntil = 0;
  const retryTimers = new Set<Timer>();

  const body = (events: IngestEvent[]): string => JSON.stringify({ ...o.header(), events });

  /** Splits events into request bodies within the count and byte limits. Oversized single events are dropped. */
  function chunks(events: IngestEvent[]): IngestEvent[][] {
    const out: IngestEvent[][] = [];
    let cur: IngestEvent[] = [];
    for (const e of events) {
      const next = cur.concat(e);
      if (next.length <= o.maxBatchSize && byteLength(body(next)) <= INGEST_LIMITS.maxBodyBytes) {
        cur = next;
        continue;
      }
      if (cur.length) out.push(cur);
      cur = byteLength(body([e])) <= INGEST_LIMITS.maxBodyBytes ? [e] : [];
    }
    if (cur.length) out.push(cur);
    return out;
  }

  function schedule(): void {
    if (flushTimer !== undefined || stopped || !queue.length) return;
    const wait = Math.max(o.flushIntervalMs, pausedUntil - now());
    flushTimer = later(() => {
      flushTimer = undefined;
      flush();
    }, wait);
  }

  function retry(job: Job, delay: number): void {
    if (job.attempts >= MAX_ATTEMPTS) return; // give up on this batch
    const t = later(() => {
      retryTimers.delete(t);
      send(job);
    }, delay);
    retryTimers.add(t);
  }

  function send(job: Job): void {
    if (stopped) return;
    job.attempts++;
    void post(o.endpoint, body(job.events)).then((res) => {
      if (stopped) return;
      const s = res.status;
      if (s >= 200 && s < 300) return;
      if (s === 403) return stop();
      if (s === 413) {
        // Too large: split in halves and try each half once more.
        if (!job.split && job.events.length > 1) {
          const half = Math.ceil(job.events.length / 2);
          send({ events: job.events.slice(0, half), attempts: 0, split: true });
          send({ events: job.events.slice(half), attempts: 0, split: true });
        }
        return;
      }
      if (s === 429) {
        const delay = parseRetryAfter(res.retryAfter, now()) ?? backoff(job.attempts);
        pausedUntil = Math.max(pausedUntil, now() + delay);
        return retry(job, delay);
      }
      if (s === 0 || s >= 500) return retry(job, backoff(job.attempts));
      // 400 and any other 4xx: the batch is invalid — never retried.
    });
  }

  function flush(): void {
    if (flushTimer !== undefined) clearTimeout(flushTimer);
    flushTimer = undefined;
    if (stopped || !queue.length) return;
    if (now() < pausedUntil) return schedule();
    const events = queue;
    queue = [];
    for (const c of chunks(events)) send({ events: c, attempts: 0, split: false });
  }

  function clear(): void {
    queue = [];
    if (flushTimer !== undefined) clearTimeout(flushTimer);
    flushTimer = undefined;
    retryTimers.forEach((t) => clearTimeout(t));
    retryTimers.clear();
  }

  function stop(): void {
    stopped = true;
    clear();
  }

  return {
    push(event) {
      if (stopped) return;
      queue.push(event);
      if (queue.length > QUEUE_CAP) queue.splice(0, queue.length - QUEUE_CAP);
      if (queue.length >= o.maxBatchSize && now() >= pausedUntil) flush();
      else schedule();
    },
    flush,
    flushBeacon() {
      // Respect a 429 back-off even on unload; events stay queued if the page comes back.
      if (stopped || !queue.length || now() < pausedUntil) return;
      if (flushTimer !== undefined) clearTimeout(flushTimer);
      flushTimer = undefined;
      const events = queue;
      queue = [];
      for (const c of chunks(events)) beacon(o.endpoint, body(c));
    },
    clear,
    stop,
    get stopped() {
      return stopped;
    },
  };
}
