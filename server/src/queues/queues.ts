import { Queue, type ConnectionOptions } from 'bullmq';
import type { MailJob } from '../services/mail/templates.js';

export const QUEUE_NAMES = {
  email: 'email',
} as const;

export function createEmailQueue(connection: ConnectionOptions): Queue<MailJob> {
  return new Queue<MailJob>(QUEUE_NAMES.email, {
    connection,
    defaultJobOptions: {
      attempts: 6,
      backoff: { type: 'exponential', delay: 5_000 },
      // Completed jobs carry links with one-time tokens; keep them briefly.
      removeOnComplete: { age: 3_600, count: 1_000 },
      // Failed jobs are kept for inspection (dead-letter view) for 14 days.
      removeOnFail: { age: 14 * 24 * 3_600 },
    },
  });
}
