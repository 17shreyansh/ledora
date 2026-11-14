import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import { logger } from '../../common/logger.js';
import type { EventEnvelope } from './events.js';
import { EventReceiptModel } from './outbox.model.js';

export interface EventConsumer {
  /** Stable name; also the queue name suffix and the receipt key. */
  name: string;
  events: ReadonlyArray<EventEnvelope['type']>;
  handle(event: EventEnvelope): Promise<void>;
}

function isDuplicateKey(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}

/**
 * Runs `consumer.handle` at most once to completion per event id. Delivery is
 * at-least-once: if the process dies after the handler's side effect but before the
 * receipt is written, the handler runs again, so handlers must tolerate repeats.
 */
export async function processWithReceipt(consumer: EventConsumer, event: EventEnvelope): Promise<'processed' | 'duplicate'> {
  if (await EventReceiptModel.exists({ consumer: consumer.name, eventId: event.id })) return 'duplicate';
  await consumer.handle(event);
  try {
    await EventReceiptModel.create({ consumer: consumer.name, eventId: event.id, processedAt: new Date() });
  } catch (err) {
    if (!isDuplicateKey(err)) throw err;
  }
  return 'processed';
}

export function consumerQueueName(consumer: Pick<EventConsumer, 'name'>): string {
  return `events-${consumer.name}`;
}

export function createConsumerQueues(connection: ConnectionOptions, consumers: readonly EventConsumer[]) {
  const routes = new Map<string, Queue<EventEnvelope>[]>();
  const queues: Queue<EventEnvelope>[] = [];
  for (const c of consumers) {
    const q = new Queue<EventEnvelope>(consumerQueueName(c), {
      connection,
      defaultJobOptions: {
        attempts: 8,
        backoff: { type: 'exponential', delay: 2_000 },
        removeOnComplete: { age: 24 * 3_600, count: 5_000 },
        removeOnFail: { age: 14 * 24 * 3_600 },
      },
    });
    queues.push(q);
    for (const t of c.events) routes.set(t, [...(routes.get(t) ?? []), q]);
  }
  return { routes, queues };
}

export function createConsumerWorkers(connection: ConnectionOptions, consumers: readonly EventConsumer[]): Worker[] {
  return consumers.map((c) => {
    const w = new Worker<EventEnvelope>(consumerQueueName(c), async (job) => {
      await processWithReceipt(c, job.data);
    }, { connection, concurrency: 5 });
    w.on('failed', (job, err) => {
      const exhausted = job ? job.attemptsMade >= (job.opts.attempts ?? 1) : true;
      logger[exhausted ? 'error' : 'warn']({ err, consumer: c.name, eventId: job?.data.id, attempt: job?.attemptsMade }, 'Event consumer failed');
    });
    return w;
  });
}
