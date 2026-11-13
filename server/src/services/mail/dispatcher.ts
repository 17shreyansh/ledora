import type { Queue } from 'bullmq';
import type { MailJob } from './templates.js';

/**
 * Request handlers never talk to SMTP directly: they hand the message to a
 * dispatcher, which in production enqueues it for the email worker (retries,
 * backoff and failure logging live there).
 */
export interface MailDispatcher {
  dispatch(job: MailJob): Promise<void>;
}

export class QueueMailDispatcher implements MailDispatcher {
  constructor(private readonly queue: Queue<MailJob>) {}

  async dispatch(job: MailJob): Promise<void> {
    await this.queue.add(job.template, job);
  }
}

/** Captures messages in memory. Used by automated tests only. */
export class MemoryMailDispatcher implements MailDispatcher {
  readonly sent: MailJob[] = [];

  async dispatch(job: MailJob): Promise<void> {
    this.sent.push(job);
  }

  last(to?: string): MailJob | undefined {
    const list = to ? this.sent.filter((m) => m.to === to) : this.sent;
    return list[list.length - 1];
  }

  clear(): void {
    this.sent.length = 0;
  }
}
