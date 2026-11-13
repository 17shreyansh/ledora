import { Worker, type ConnectionOptions } from 'bullmq';
import { logger } from '../common/logger.js';
import { QUEUE_NAMES } from '../queues/queues.js';
import { renderMail, type MailJob } from '../services/mail/templates.js';
import type { MailTransport } from '../services/mail/transport.js';

export function createEmailWorker(connection: ConnectionOptions, transport: MailTransport): Worker<MailJob> {
  const worker = new Worker<MailJob>(
    QUEUE_NAMES.email,
    async (job) => {
      const rendered = renderMail(job.data);
      await transport.send(job.data.to, rendered);
    },
    { connection, concurrency: 5 },
  );
  worker.on('failed', (job, err) => {
    const exhausted = job ? job.attemptsMade >= (job.opts.attempts ?? 1) : true;
    logger[exhausted ? 'error' : 'warn'](
      { err, jobId: job?.id, template: job?.data.template, attempt: job?.attemptsMade, exhausted },
      exhausted ? 'Email delivery failed permanently' : 'Email delivery failed; will retry',
    );
  });
  return worker;
}
