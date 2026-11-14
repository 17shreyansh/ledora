import { createLogger, logger, setLogger } from './common/logger.js';
import { loadConfig } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './database/connection.js';
import { createRedis } from './database/redis.js';
import { createConsumerQueues, createConsumerWorkers } from './modules/events/consumers.js';
import { onboardingNotificationsConsumer } from './modules/events/onboardingNotifications.consumer.js';
import { relayOutboxOnce } from './modules/events/relay.js';
import { createEmailQueue } from './queues/queues.js';
import { QueueMailDispatcher } from './services/mail/dispatcher.js';
import { createMailTransport } from './services/mail/transport.js';
import { createEmailWorker } from './workers/email.worker.js';

/** Background worker process. Runs separately from the API so slow jobs never delay requests. */
async function main() {
  const config = loadConfig();
  setLogger(createLogger(config.LOG_LEVEL, !config.isProduction && process.stdout.isTTY));
  await connectDatabase(config.MONGODB_URI, { autoIndex: false });
  const conn = () => createRedis(config.REDIS_URL, 'worker');

  const emailQueue = createEmailQueue(conn());
  const consumers = [onboardingNotificationsConsumer(config, new QueueMailDispatcher(emailQueue))];
  const { routes, queues } = createConsumerQueues(conn(), consumers);
  const workers = [createEmailWorker(conn(), createMailTransport(config)), ...createConsumerWorkers(conn(), consumers)];

  // Outbox relay: poll every second; several worker processes may run it safely.
  let stopping = false;
  const relayLoop = (async () => {
    while (!stopping) {
      try {
        const n = await relayOutboxOnce(routes);
        if (n === 0) await new Promise((r) => setTimeout(r, 1_000));
      } catch (err) {
        logger.error({ err }, 'Outbox relay failed; retrying');
        await new Promise((r) => setTimeout(r, 5_000));
      }
    }
  })();

  logger.info({ workers: workers.map((w) => w.name) }, 'Ledora worker started');

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Worker shutting down; finishing in-flight jobs');
    const force = setTimeout(() => process.exit(1), 30_000);
    force.unref();
    stopping = true;
    await relayLoop;
    await Promise.allSettled(workers.map((w) => w.close()));
    await Promise.allSettled([...queues, emailQueue].map((q) => q.close()));
    await disconnectDatabase();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start worker');
  process.exit(1);
});
