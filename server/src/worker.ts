import { createLogger, logger, setLogger } from './common/logger.js';
import { loadConfig } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './database/connection.js';
import { createRedis } from './database/redis.js';
import { createMailTransport } from './services/mail/transport.js';
import { createEmailWorker } from './workers/email.worker.js';

/** Background worker process. Runs separately from the API so slow jobs never delay requests. */
async function main() {
  const config = loadConfig();
  setLogger(createLogger(config.LOG_LEVEL, !config.isProduction && process.stdout.isTTY));
  await connectDatabase(config.MONGODB_URI, { autoIndex: false });
  const workers = [createEmailWorker(createRedis(config.REDIS_URL, 'worker-email'), createMailTransport(config))];
  logger.info({ workers: workers.map((w) => w.name) }, 'Ledora worker started');

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Worker shutting down; finishing in-flight jobs');
    const force = setTimeout(() => process.exit(1), 30_000);
    force.unref();
    await Promise.allSettled(workers.map((w) => w.close()));
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
